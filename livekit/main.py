from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent
from livekit.plugins import groq
from livekit.plugins import deepgram
import json
load_dotenv()


class Assistant(Agent):
    def __init__(self,instructions) -> None:
        super().__init__(instructions=instructions)



async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()

    participant = await ctx.wait_for_participant()
    metadata = json.loads(participant.metadata)
    instructions=metadata.get("prompt","You are an AI Assistant that help user in any query.")

    session = AgentSession(
        stt = deepgram.STT(
            model="nova-3",
        ),
        llm=groq.LLM(
            model="llama3-8b-8192",
            temperature=0.3
        ),
        tts=deepgram.TTS(
            model="aura-asteria-en",
        )
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=instructions)
    )

    await session.generate_reply()


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))