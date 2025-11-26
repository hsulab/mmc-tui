import time

from fastapi import FastAPI

app = FastAPI()


@app.post("/run")
async def run_workflow():
    """Placeholder workflow endpoint.

    TUI clients can call this route to kick off a run. For now it simply
    returns a static string so the frontend can confirm the wiring between
    the TUI and FastAPI backend.
    """

    # Sleep for a bit to simulate work being done
    time.sleep(10)

    return {"result": "Workflow executed successfully from FastAPI"}
