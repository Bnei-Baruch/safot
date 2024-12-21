from provider_libs import TranslationProvider
from docx import Document
from io import BytesIO
import argparse

parser = argparse.ArgumentParser(description="Providers tool")

DEFAULT_PROMPT = (
    "Translate the following text into [target language], maintaining the original meaning and structure. "
    "The translation should reflect the precise concepts and teachings of Kabbalist Michael Laitman, "
    "adhering closely to the authentic style and terminology of Kabbalah. Avoid rephrasing or altering the intent "
    "of the original text while ensuring linguistic accuracy and fluency. Preserve the `|||` separator exactly as it appears in the text."
)

parser.add_argument("-i", "--input", type=str, help="Docx to translate")
parser.add_argument("-o", "--output", type=str, help="Translated docx")
parser.add_argument("-m", "--model", type=str, default="gpt-3.5-turbo", help="Which model to use")
parser.add_argument("-t", "--target_language", type=str, default="Hebrew", help="Target language for translation")
parser.add_argument("-p", "--prompt", type=str, default=DEFAULT_PROMPT, help="Translation prompt")
parser.add_argument("-a", "--apply", type=bool, default=False, help="If false will not really call the API")

args = parser.parse_args()

def generate_docx(paragraphs, output_filename):
    doc = Document()
    for para in paragraphs:
        doc.add_paragraph(para)
    doc.save(output_filename)

def main():
    paragraphs = []
    with open(args.input, 'rb') as file:
        content = file.read()
        document = Document(BytesIO(content))
        for p in document.paragraphs:
            paragraphs.append(p.text)

    # Uncomment when testing to not waste money.
    # paragraphs = paragraphs[:100]

    print(f"Translating {len(paragraphs)} paragraphs.")
    translated_paragraphs = []
    if args.apply:
        # Create a TranslationProvider object
        translator = TranslationProvider(
            model=args.model,
            prompt=args.prompt,
            target_language=args.target_language,
            paragraphs=paragraphs
        )

        # Run the translation process
        print("Starting translation...")
        translated_paragraphs = translator.translate_text(output_ratio=1.2)
    else:
        translated_paragraphs = [f"Tr {p}" for p in paragraphs]

    # Display the translated paragraphs
    print("\nTranslated Paragraphs:")
    for i, paragraph in enumerate(translated_paragraphs, 1):
        print(f"Paragraph {i}: {paragraph}")

    generate_docx(translated_paragraphs, args.output)


if __name__ == "__main__":
    main()
