from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from app.models.schemas import AssistantChatRequest, AssistantChatResponse, PaperQARequest, PaperQAResponse
from app.services.assistant_service import generate_assistant_response, answer_paper_qa
from app.services.council_service import MultiLLMCouncilService, CouncilConsensusResult

router = APIRouter(prefix="/api/assistant", tags=["AI Research Assistant"])

class CouncilDeliberationRequest(BaseModel):
    topic: str
    paper_title: Optional[str] = "General Research Formulation"
    text_slice: Optional[str] = ""
    query: Optional[str] = None
    active_members: Optional[List[str]] = None

@router.post("/council", response_model=CouncilConsensusResult)
async def run_council_deliberation(request: CouncilDeliberationRequest):
    """
    Multi-LLM Council Deliberation endpoint.
    Pits multiple models against each other to catch hallucinations and synthesize verified academic consensus.
    """
    try:
        return await MultiLLMCouncilService.deliberate(
            topic=request.topic,
            paper_title=request.paper_title,
            text_slice=request.text_slice,
            active_members=request.active_members
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Council deliberation error: {str(e)}")

@router.post("/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(request: AssistantChatRequest):
    """Interactive chat endpoint for narrowing research scope and generating academic queries."""
    try:
        response = await generate_assistant_response(
            messages=request.messages,
            provider=request.model_provider,
            model_name=request.model_name,
            groq_key=request.groq_api_key,
            gemini_key=request.gemini_api_key,
            openrouter_key=request.openrouter_api_key,
            deepseek_key=request.deepseek_api_key,
            nvidia_key=request.nvidia_api_key
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assistant chat error: {str(e)}")

@router.post("/paper-qa", response_model=PaperQAResponse)
async def ask_paper_qa(request: PaperQARequest):
    """Interactive grounded Q&A endpoint for asking questions about synthesized literature."""
    try:
        result = await answer_paper_qa(
            query=request.query,
            papers=request.papers,
            chat_history=request.chat_history,
            provider=request.model_provider,
            model_name=request.model_name,
            groq_key=request.groq_api_key,
            gemini_key=request.gemini_api_key,
            openrouter_key=request.openrouter_api_key,
            deepseek_key=request.deepseek_api_key,
            nvidia_key=request.nvidia_api_key,
            custom_key=request.custom_api_key,
            custom_base_url=request.custom_base_url
        )
        return PaperQAResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Paper Q&A error: {str(e)}")
