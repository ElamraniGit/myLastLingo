"""API routes for LinguaLearn."""

from fastapi import APIRouter
from .videos import router as videos_router
from .transcripts import router as transcripts_router
from .dictionary import router as dictionary_router
from .vocabulary import router as vocabulary_router
from .review import router as review_router
from .optimizer import router as optimizer_router
from .player import router as player_router
from .auth import router as auth_router
from .library import router as library_router
from .chat import router as chat_router
from .xp import router as xp_router
from .tts import router as tts_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["Auth"])
router.include_router(videos_router, prefix="/videos", tags=["Videos"])
router.include_router(transcripts_router, prefix="/transcripts", tags=["Transcripts"])
router.include_router(dictionary_router, prefix="/dictionary", tags=["Dictionary"])
router.include_router(vocabulary_router, prefix="/vocabulary", tags=["Vocabulary"])
router.include_router(review_router, prefix="/review", tags=["Smart Review"])
router.include_router(optimizer_router, prefix="/v3", tags=["v3 Optimizer / Intro / Heatmap"])
router.include_router(player_router, prefix="/player", tags=["Player"])
router.include_router(library_router, prefix="/library", tags=["Library"])
router.include_router(chat_router, prefix="/chat", tags=["Chat"])
router.include_router(xp_router, prefix="/xp", tags=["XP"])
router.include_router(tts_router, prefix="/tts", tags=["TTS"])
