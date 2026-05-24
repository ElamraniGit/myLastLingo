"""API routes for LinguaLearn."""

from fastapi import APIRouter
from .videos import router as videos_router
from .transcripts import router as transcripts_router
from .dictionary import router as dictionary_router
from .vocabulary import router as vocabulary_router
from .player import router as player_router

router = APIRouter()

router.include_router(videos_router, prefix="/videos", tags=["Videos"])
router.include_router(transcripts_router, prefix="/transcripts", tags=["Transcripts"])
router.include_router(dictionary_router, prefix="/dictionary", tags=["Dictionary"])
router.include_router(vocabulary_router, prefix="/vocabulary", tags=["Vocabulary"])
router.include_router(player_router, prefix="/player", tags=["Player"])