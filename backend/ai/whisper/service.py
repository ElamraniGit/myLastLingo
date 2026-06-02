"""
Whisper Speech-to-Text Service for LinguaLearn.
Runs completely locally using faster-whisper optimized for mobile/ARM.
"""

import os
import json
import time
import logging
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class WhisperConfig:
    model: str = "base"
    model_path: str = "models/whisper/"
    language: str = "en"
    compute_type: str = "int8"
    beam_size: int = 1
    vad_filter: bool = True
    word_timestamps: bool = True


class WhisperService:
    """
    Local Whisper transcription service using faster-whisper.
    Optimized for ARM64 (Android/Termux) with int8 quantization.
    """
    
    def __init__(self, config: Optional[WhisperConfig] = None):
        self.config = config or WhisperConfig()
        self.model = None
        self._model_lock = False
        self._loaded = False
        
    async def load_model(self):
        """Load the Whisper model (lazy loading on first use)."""
        if self._loaded:
            return
        
        logger.info(f"Loading Whisper model: {self.config.model}")
        start_time = time.time()
        
        try:
            from faster_whisper import WhisperModel
            
            model_path = str(Path(self.config.model_path) / self.config.model)
            
            # Use int8 for mobile optimization
            self.model = WhisperModel(
                model_size_or_path=self.config.model,
                device="cpu",
                compute_type=self.config.compute_type,
                download_root=self.config.model_path,
                cpu_threads=4,
                num_workers=1
            )
            
            self._loaded = True
            load_time = time.time() - start_time
            logger.info(f"Whisper model loaded in {load_time:.2f}s")
            
        except ImportError:
            logger.error("faster-whisper not installed. Install with: pip install faster-whisper")
            raise
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    async def transcribe(
        self, 
        audio_path: str, 
        language: Optional[str] = None,
        on_progress: Optional[Callable] = None
    ) -> List[Dict[str, Any]]:
        """
        Transcribe audio file to text with timestamps.
        
        Args:
            audio_path: Path to audio file
            language: Language code (default: en)
            on_progress: Optional progress callback
            
        Returns:
            List of segment dicts with text, start, end, and word timings
        """
        await self.load_model()
        
        lang = language or self.config.language
        logger.info(f"Starting transcription: {audio_path} (lang={lang})")
        
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        segments = []
        start_time = time.time()
        
        try:
            # Run transcription
            segment_generator, info = self.model.transcribe(
                audio_path,
                language=lang,
                beam_size=self.config.beam_size,
                vad_filter=self.config.vad_filter,
                word_timestamps=self.config.word_timestamps,
                condition_on_previous_text=True,
                no_speech_threshold=0.6,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
            )
            
            detected_language = info.language
            language_probability = info.language_probability
            logger.info(f"Detected language: {detected_language} (prob: {language_probability:.2f})")
            
            # Process segments
            for i, segment in enumerate(segment_generator):
                seg_data = {
                    'index': i,
                    'start': round(segment.start, 3),
                    'end': round(segment.end, 3),
                    'text': segment.text.strip(),
                    'duration': round(segment.end - segment.start, 3),
                    'words': []
                }
                
                # Process word-level timestamps
                if segment.words:
                    for word in segment.words:
                        seg_data['words'].append({
                            'word': word.word.strip(),
                            'start': round(word.start, 3),
                            'end': round(word.end, 3),
                            'probability': round(word.probability, 3) if hasattr(word, 'probability') else 1.0
                        })
                
                segments.append(seg_data)
                
                if on_progress:
                    # faster-whisper yields a lazy generator with no known length,
                    # so we report incremental progress without a total. (Never call
                    # list() here — it would consume the generator and drop segments.)
                    on_progress(None, seg_data)
            
            elapsed = time.time() - start_time
            logger.info(f"Transcription complete: {len(segments)} segments in {elapsed:.2f}s")
            
            return segments
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}", exc_info=True)
            raise
    
    async def transcribe_file(
        self, 
        video_path: str, 
        language: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract audio and transcribe a video file.
        """
        import subprocess
        
        audio_path = str(Path(video_path).with_suffix('.wav'))
        
        # Extract audio with ffmpeg
        logger.info(f"Extracting audio from: {video_path}")
        cmd = [
            'ffmpeg', '-i', video_path,
            '-vn', '-acodec', 'pcm_s16le',
            '-ar', '16000', '-ac', '1',
            '-y', audio_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"Audio extracted: {audio_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Audio extraction failed: {e.stderr.decode()}")
            raise
        
        # Transcribe
        segments = await self.transcribe(audio_path, language)
        
        # Cleanup audio file
        Path(audio_path).unlink(missing_ok=True)
        
        return segments
    
    def unload_model(self):
        """Free memory by unloading the model."""
        if self.model:
            self.model = None
            self._loaded = False
            logger.info("Whisper model unloaded")
    
    @property
    def is_loaded(self) -> bool:
        return self._loaded