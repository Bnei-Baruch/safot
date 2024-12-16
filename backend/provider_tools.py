from provider_libs import TranslationProvider

def main():

    model = "gpt-4"
    prompt = (
        "Translate the following text into [target language], maintaining the original meaning and structure. "
        "The translation should reflect the precise concepts and teachings of Kabbalist Michael Laitman, "
        "adhering closely to the authentic style and terminology of Kabbalah. Avoid rephrasing or altering the intent "
        "of the original text while ensuring linguistic accuracy and fluency. Preserve the `|||` separator exactly as it appears in the text."
    )
    target_language = "English"

    paragraphs = [
        "כל המקרים הרעים באים לטובתי כדי שאתעלה על ידם. הם לא מכשול, אלא קרש קפיצה.",
        "מה כדאי ללמוד מהעבר? איך לעשות פחות טעויות ולכוון את עצמי מרגע זה והלאה למטרה הנעלה ביותר שאוכל להשיג.",
        "כשנהפוך את עצמנו לטובים, נרגיש שזה הסוף של כל הרע.",
        "עלינו להיות כצינור, כמעבר של כוח האהבה והנתינה לכל המציאות."
    ]

    # Create a TranslationProvider object
    translator = TranslationProvider(
        model=model,
        prompt=prompt,
        target_language=target_language,
        paragraphs=paragraphs
    )

    # Run the translation process
    print("Starting translation...")
    translated_paragraphs = translator.translate_text(output_ratio=1.2)

    # Display the translated paragraphs
    print("\nTranslated Paragraphs:")
    for i, paragraph in enumerate(translated_paragraphs, 1):
        print(f"Paragraph {i}: {paragraph}")

if __name__ == "__main__":
    main()
