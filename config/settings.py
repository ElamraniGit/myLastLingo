"""
Configuration loader for LinguaLearn application.
Loads settings from yaml config and environment.
"""

import os
import yaml
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from typing import List

@dataclass
class AppConfig:
    name: str = "LinguaLearn"
    version: str = "1.0.0"
    environment: str = "production"
    debug: bool = False

@dataclass
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 8080
    workers: int = 1
    cors_origins: List[str] = field(default_factory=lambda: ["*"])

@dataclass
class DatabaseConfig:
    path: str = "data/lingualearn.db"
    pool_size: int = 5
    timeout: int = 30

@dataclass
class WhisperConfig:
    model: str = "base"
    model_path: str = "models/whisper/"
    language: str = "en"
    compute_type: str = "int8"
    beam_size: int = 1
    vad_filter: bool = True
    word_timestamps: bool = True

@dataclass
class DictionaryConfig:
    type: str = "local"
    path: str = "data/dictionary/"

@dataclass
class LLMConfig:
    enabled: bool = False
    model: str = "tinyllama-1.1b"
    model_path: str = "models/llm/"

@dataclass
class AIConfig:
    whisper: WhisperConfig = field(default_factory=WhisperConfig)
    dictionary: DictionaryConfig = field(default_factory=DictionaryConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)

@dataclass
class CacheConfig:
    video_cache: str = "data/cache/videos/"
    transcript_cache: str = "data/cache/transcripts/"
    thumbnail_cache: str = "data/cache/thumbnails/"
    max_size_mb: int = 500

@dataclass
class YouTubeConfig:
    download_path: str = "data/downloads/"
    subtitles_lang: List[str] = field(default_factory=lambda: ["en", "ar"])
    max_resolution: str = "720p"

@dataclass
class SpacedRepetitionConfig:
    algorithm: str = "sm2"
    default_ease: float = 2.5
    max_reviews_per_day: int = 100

@dataclass
class LoggingConfig:
    level: str = "INFO"
    file: str = "logs/app.log"
    max_size_mb: int = 10
    backup_count: int = 3

@dataclass
class Config:
    app: AppConfig = field(default_factory=AppConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    ai: AIConfig = field(default_factory=AIConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    youtube: YouTubeConfig = field(default_factory=YouTubeConfig)
    spaced_repetition: SpacedRepetitionConfig = field(default_factory=SpacedRepetitionConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


def load_config(config_path: Optional[str] = None) -> Config:
    """
    Load configuration from YAML file with environment overrides.
    Falls back to defaults if no config file exists.
    """
    config = Config()
    
    if config_path is None:
        # Look for config in default locations
        possible_paths = [
            Path("config/settings.yaml"),
            Path("../config/settings.yaml"),
            Path(os.path.expanduser("~/.lingualearn/config.yaml")),
        ]
        
        for p in possible_paths:
            if p.exists():
                config_path = str(p)
                break
    
    if config_path and Path(config_path).exists():
        with open(config_path, 'r') as f:
            raw_config = yaml.safe_load(f)
        
        if raw_config:
            # Apply YAML config over defaults
            if 'app' in raw_config:
                for key, value in raw_config['app'].items():
                    if hasattr(config.app, key):
                        setattr(config.app, key, value)
            
            if 'server' in raw_config:
                for key, value in raw_config['server'].items():
                    if hasattr(config.server, key):
                        setattr(config.server, key, value)
            
            if 'database' in raw_config:
                for key, value in raw_config['database'].items():
                    if hasattr(config.database, key):
                        setattr(config.database, key, value)
            
            if 'ai' in raw_config:
                ai = raw_config['ai']
                if 'whisper' in ai:
                    for key, value in ai['whisper'].items():
                        if hasattr(config.ai.whisper, key):
                            setattr(config.ai.whisper, key, value)
                if 'dictionary' in ai:
                    for key, value in ai['dictionary'].items():
                        if hasattr(config.ai.dictionary, key):
                            setattr(config.ai.dictionary, key, value)
                if 'llm' in ai:
                    for key, value in ai['llm'].items():
                        if hasattr(config.ai.llm, key):
                            setattr(config.ai.llm, key, value)
            
            if 'cache' in raw_config:
                for key, value in raw_config['cache'].items():
                    if hasattr(config.cache, key):
                        setattr(config.cache, key, value)
            
            if 'youtube' in raw_config:
                for key, value in raw_config['youtube'].items():
                    if hasattr(config.youtube, key):
                        setattr(config.youtube, key, value)
            
            if 'spaced_repetition' in raw_config:
                for key, value in raw_config['spaced_repetition'].items():
                    if hasattr(config.spaced_repetition, key):
                        setattr(config.spaced_repetition, key, value)
            
            if 'logging' in raw_config:
                for key, value in raw_config['logging'].items():
                    if hasattr(config.logging, key):
                        setattr(config.logging, key, value)
    
    # Environment variable overrides (for Docker/CI)
    env_mappings = {
        'LINGUALEARN_DEBUG': ('app', 'debug'),
        'LINGUALEARN_PORT': ('server', 'port'),
        'LINGUALEARN_HOST': ('server', 'host'),
        'LINGUALEARN_DB_PATH': ('database', 'path'),
        'LINGUALEARN_WHISPER_MODEL': ('ai', 'whisper', 'model'),
        'LINGUALEARN_LOG_LEVEL': ('logging', 'level'),
    }
    
    for env_var, attrs in env_mappings.items():
        if env_var in os.environ:
            value = os.environ[env_var]
            obj = config
            for attr in attrs[:-1]:
                obj = getattr(obj, attr)
            # Convert type
            current = getattr(obj, attrs[-1])
            if isinstance(current, bool):
                value = value.lower() in ('true', '1', 'yes')
            elif isinstance(current, int):
                value = int(value)
            setattr(obj, attrs[-1], value)
    
    return config