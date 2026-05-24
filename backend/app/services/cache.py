"""
Local caching service for optimized performance on mobile devices.
"""

import os
import json
import time
import shutil
import logging
import hashlib
from pathlib import Path
from typing import Optional, Any, Dict
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    video_cache: str = "data/cache/videos/"
    transcript_cache: str = "data/cache/transcripts/"
    thumbnail_cache: str = "data/cache/thumbnails/"
    max_size_mb: int = 500


class CacheManager:
    """
    Local cache manager for videos, transcripts, and thumbnails.
    Uses LRU-based eviction when cache exceeds max size.
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'size_mb': 0
        }
    
    async def initialize(self):
        """Initialize cache directories and load stats."""
        for cache_dir in [
            self.config.video_cache,
            self.config.transcript_cache,
            self.config.thumbnail_cache
        ]:
            Path(cache_dir).mkdir(parents=True, exist_ok=True)
        
        logger.info("Cache manager initialized")
    
    async def get_cached_transcript(self, video_id: str, language: str = 'en') -> Optional[Dict]:
        """Get cached transcript if available and fresh."""
        cache_key = f"{video_id}_{language}"
        cache_path = Path(self.config.transcript_cache) / f"{cache_key}.json"
        
        if cache_path.exists():
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check if cache is still fresh (7 days)
                cached_time = datetime.fromisoformat(data.get('cached_at', '2000-01-01'))
                if datetime.now() - cached_time < timedelta(days=7):
                    self._cache_stats['hits'] += 1
                    logger.debug(f"Cache hit: transcript {cache_key}")
                    return data.get('transcript')
                else:
                    logger.debug(f"Cache expired: transcript {cache_key}")
                    cache_path.unlink(missing_ok=True)
            except Exception as e:
                logger.warning(f"Cache read failed: {e}")
                cache_path.unlink(missing_ok=True)
        
        self._cache_stats['misses'] += 1
        return None
    
    async def cache_transcript(self, video_id: str, language: str, transcript: Dict):
        """Cache a transcript for future use."""
        cache_key = f"{video_id}_{language}"
        cache_path = Path(self.config.transcript_cache) / f"{cache_key}.json"
        
        try:
            cache_data = {
                'cached_at': datetime.now().isoformat(),
                'video_id': video_id,
                'language': language,
                'transcript': transcript
            }
            
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False)
            
            logger.debug(f"Transcript cached: {cache_key}")
            
            # Check cache size
            await self._enforce_cache_limit()
            
        except Exception as e:
            logger.warning(f"Failed to cache transcript: {e}")
    
    async def cache_thumbnail(self, video_id: str, thumbnail_url: str) -> Optional[str]:
        """Download and cache video thumbnail."""
        import aiohttp
        
        cache_path = Path(self.config.thumbnail_cache) / f"{video_id}.jpg"
        
        if cache_path.exists():
            return str(cache_path)
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(thumbnail_url) as response:
                    if response.status == 200:
                        content = await response.read()
                        cache_path.write_bytes(content)
                        logger.debug(f"Thumbnail cached: {video_id}")
                        return str(cache_path)
        except Exception as e:
            logger.warning(f"Thumbnail cache failed: {e}")
        
        return None
    
    def get_cached_video_path(self, youtube_id: str) -> Optional[str]:
        """Get path to cached video file if exists."""
        for ext in ['.mp4', '.webm', '.mkv']:
            video_path = Path(self.config.video_cache) / f"{youtube_id}{ext}"
            if video_path.exists():
                return str(video_path)
        return None
    
    async def _enforce_cache_limit(self):
        """Remove oldest files if cache exceeds max size."""
        max_bytes = self.config.max_size_mb * 1024 * 1024
        
        for cache_dir in [
            self.config.transcript_cache,
            self.config.thumbnail_cache
        ]:
            path = Path(cache_dir)
            if not path.exists():
                continue
            
            total_size = sum(f.stat().st_size for f in path.glob('*') if f.is_file())
            
            if total_size > max_bytes:
                logger.info(f"Cache size {total_size} exceeds limit, cleaning...")
                
                # Get files sorted by modification time
                files = sorted(
                    path.glob('*'),
                    key=lambda f: f.stat().st_mtime
                )
                
                # Remove oldest files until under 80% of limit
                target_size = int(max_bytes * 0.8)
                for f in files:
                    if total_size <= target_size:
                        break
                    size = f.stat().st_size
                    f.unlink()
                    total_size -= size
                    logger.debug(f"Removed cache file: {f.name}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        hit_rate = 0
        total = self._cache_stats['hits'] + self._cache_stats['misses']
        if total > 0:
            hit_rate = (self._cache_stats['hits'] / total) * 100
        
        # Calculate current cache sizes
        sizes = {}
        for name, cache_dir in [
            ('transcripts', self.config.transcript_cache),
            ('thumbnails', self.config.thumbnail_cache),
            ('videos', self.config.video_cache)
        ]:
            path = Path(cache_dir)
            if path.exists():
                sizes[name] = sum(
                    f.stat().st_size for f in path.glob('*') if f.is_file()
                )
        
        return {
            'hits': self._cache_stats['hits'],
            'misses': self._cache_stats['misses'],
            'hit_rate': round(hit_rate, 2),
            'sizes_bytes': sizes,
            'total_mb': round(sum(sizes.values()) / (1024 * 1024), 2)
        }
    
    async def clear_all(self):
        """Clear all cached data."""
        for cache_dir in [
            self.config.video_cache,
            self.config.transcript_cache,
            self.config.thumbnail_cache
        ]:
            path = Path(cache_dir)
            if path.exists():
                shutil.rmtree(path)
                path.mkdir(parents=True, exist_ok=True)
        
        self._cache_stats = {'hits': 0, 'misses': 0, 'size_mb': 0}
        logger.info("All cache cleared")
    
    async def close(self):
        """Cleanup cache manager."""
        logger.info("Cache manager closed")