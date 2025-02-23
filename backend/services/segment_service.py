from datetime import datetime
from io import BytesIO
from docx import Document
from models import Segment
from playhouse.shortcuts import model_to_dict


def save_segments_from_file(file, source_id, properties_dict, user_info):
    try:
        content = file.file.read()
        document = Document(BytesIO(content))
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]

        segments = []
        now = datetime.utcnow()
        for order, text in enumerate(paragraphs):
            segment = Segment.create(
                timestamp=now,
                username=user_info['preferred_username'],
                text=text,
                source_id=source_id,
                order=order,
                properties={**properties_dict, "segment_type": "file"}
            )
            segments.append(model_to_dict(segment))

        return {"source_id": source_id, "segments": segments}

    except Exception as e:
        raise Exception(f"Failed to process file: {str(e)}")
