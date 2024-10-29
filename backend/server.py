from typing import Union
from io import BytesIO

from fastapi import FastAPI, UploadFile
from docx import Document

app = FastAPI()


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
