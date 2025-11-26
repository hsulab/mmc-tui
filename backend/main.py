import math
import random
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
    time.sleep(5)

    return {"result": "Workflow executed successfully from FastAPI"}


@app.get("/simulation/{node_id}")
async def simulation(node_id: str):
    """Return pseudo simulation data for a compute node.

    The response contains two arrays: the first for time (seconds) and the
    second for temperatures. This allows the TUI to plot charts without a real
    backend implementation.
    """

    points = 100
    timestep = 0.25
    time_axis = [round(i * timestep, 2) for i in range(points)]
    temperatures = [
        round(20 + math.sin(i / 8) * 5 + (i / points) * 3, 3)
        - 20
        + random.randint(-100, 100) / 100
        for i in range(points)
    ]

    return {"node_id": node_id, "data": [time_axis, temperatures]}
