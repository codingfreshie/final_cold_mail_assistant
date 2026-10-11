#!/usr/bin/env python3
import sys
import os
from dotenv import load_dotenv
import fitz  # PyMuPDF

# Optional vector DB creation
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    try:
        from langchain_chroma import Chroma  # preferred package
    except Exception:  # fallback for older setups
        from langchain_community.vectorstores import Chroma  # type: ignore
    LANGCHAIN_AVAILABLE = True
except Exception:
    LANGCHAIN_AVAILABLE = False


def extract_text_from_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    try:
        text_chunks = []
        for page in doc:
            text_chunks.append(page.get_text())
        return "".join(text_chunks)
    finally:
        doc.close()


def main():
    # Args: input_pdf_path username output_txt_path
    if len(sys.argv) != 4:
        sys.stderr.write("Usage: extract_pdf.py <input_pdf_path> <username> <output_txt_path>\n")
        sys.exit(2)

    input_pdf = sys.argv[1]
    username = sys.argv[2]
    output_txt = sys.argv[3]

    try:
        # Extract and save resume text
        pdf_text = extract_text_from_pdf(input_pdf)
        # Ensure target directory exists
        out_dir = os.path.dirname(output_txt)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(output_txt, "w", encoding="utf-8") as f:
            f.write(pdf_text)
    except Exception as e:
        sys.stderr.write(f"Error extracting/saving text: {e}\n")
        sys.exit(1)

    # Load environment
    load_dotenv()
    # Support GEMINI_API_KEY fallback for LangChain Google embeddings
    if not os.getenv("GOOGLE_API_KEY") and os.getenv("GEMINI_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

    # Build per-user Chroma persistence directory under backend/chroma_dbs/<username>
    base_dir = os.path.join(os.path.dirname(__file__), "chroma_dbs")
    persist_dir = os.path.join(base_dir, username)

    # If LangChain is not available, just report created text file and exit
    if not LANGCHAIN_AVAILABLE:
        print(f"DB_SKIPPED LangChain not installed; would store at {persist_dir}")
        sys.exit(0)

    try:
        # If DB already exists, do not recreate
        if os.path.exists(persist_dir):
            print(f"DB_EXISTS {persist_dir}")
            sys.exit(0)

        os.makedirs(base_dir, exist_ok=True)
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        vectorstore = Chroma.from_texts(
            texts=[pdf_text],
            embedding=embeddings,
            persist_directory=persist_dir
        )
        vectorstore.persist()
        print(f"DB_CREATED {persist_dir}")
        sys.exit(0)
    except Exception as e:
        sys.stderr.write(f"Error creating vector DB: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main() 