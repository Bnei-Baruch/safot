from typing import Union
from io import BytesIO

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from docx import Document
import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

# Retrieve allowed origins from environment variable, defaulting to an empty list
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Allows requests from your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

@app.post("/docx2text")
def docx2text(file: UploadFile):
	ret = []
	content = file.file.read()
	print("content: ")
	print(content)
	document = Document(BytesIO(content))
	for p in document.paragraphs:
		ret.append(p.text)
	return ret
