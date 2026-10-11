#!/usr/bin/env python3
import os
import sys
import json
import getpass
import warnings
from dotenv import load_dotenv

# Silence deprecation and other warnings to avoid noisy stderr
warnings.filterwarnings("ignore")

# LangChain imports
from pydantic import BaseModel, Field
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langchain.agents import tool, create_openai_functions_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

# Prefer langchain-chroma package; fallback to community
try:
    from langchain_chroma import Chroma  # type: ignore
except Exception:  # pragma: no cover
    from langchain_community.vectorstores import Chroma  # type: ignore

# Prefer new tavily package; fallback to deprecated community tool
_TAVILY_NEW = False
try:
    from langchain_tavily import TavilySearch
    _TAVILY_NEW = True
except Exception:  # pragma: no cover
    try:
        from langchain_community.tools.tavily_search import TavilySearchResults  # type: ignore
    except Exception:
        TavilySearchResults = None  # type: ignore


class EmailOutput(BaseModel):
    subject: str = Field(..., description="One-sentence email subject")
    body: str = Field(..., description="Full body of the email")


def load_env_keys():
    load_dotenv()
    # Map GEMINI to GOOGLE if needed
    if not os.getenv("GOOGLE_API_KEY") and os.getenv("GEMINI_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

    # Do not prompt for keys in non-interactive mode; just skip if missing
    # Tavily key is optional; WebSearch will return empty results if missing


def build_vectorstore(username: str):
    # DB path under backend/chroma_dbs/<username>
    base_dir = os.path.dirname(__file__)
    persist_dir = os.path.join(base_dir, "chroma_dbs", username)
    if not os.path.exists(persist_dir):
        raise ValueError(f"No database found for username '{username}'. Please upload/process the resume first.")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    vectorstore = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
    return vectorstore, persist_dir


def create_agent(vectorstore):
    llm = ChatGoogleGenerativeAI(model="models/gemini-1.5-flash", temperature=0)

    @tool
    def RAGTool(query: str) -> str:
        """Retrieve sender details from Chroma database (resume)."""
        docs = vectorstore.similarity_search(query, k=1)
        return docs[0].page_content if docs else "No relevant sender details found."

    # Tavily tool setup (optional)
    tavily_api = os.getenv("TAVILY_API_KEY")
    tavily_search_tool = None
    if tavily_api:
        try:
            if _TAVILY_NEW:
                tavily_search_tool = TavilySearch(max_results=3)
            elif TavilySearchResults is not None:
                tavily_search_tool = TavilySearchResults(max_results=3)
        except Exception:
            tavily_search_tool = None

    @tool
    def WebSearch(query: str) -> str:
        """Search the web for additional information. Returns empty list if Tavily is not configured."""
        if not tavily_search_tool:
            return json.dumps([], indent=2)
        try:
            results = tavily_search_tool.invoke({"query": query})
            return json.dumps(results, indent=2)
        except Exception:
            return json.dumps([], indent=2)

    @tool
    def GenerateFunction(topic: str, rag_context: str, web_context: str) -> str:
        """
        Generate final email using RAG + WebSearch details.
        """
        parser = JsonOutputParser(pydantic_object=EmailOutput)

        prompt = PromptTemplate(
            template="""{format_instructions}

You are a professional email assistant. Use the details provided to draft a professional email.

TOPIC:
{topic}

SENDER DETAILS (from RAG):
{rag_context}

ADDITIONAL INFO (from WebSearch):
{web_context}

INSTRUCTIONS:
- Use ONLY factual info from RAG or WebSearch.
- Subject must be short and informative.
- Body must be professional and relevant.
- Output a valid JSON object.
""",
            input_variables=["topic", "rag_context", "web_context"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt | llm | parser
        result = chain.invoke({
            "topic": topic,
            "rag_context": rag_context,
            "web_context": web_context
        })
        return json.dumps(result)

    tools = [RAGTool, WebSearch, GenerateFunction]

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are an assistant that follows these steps:
1) Always call RAGTool first with the original input to get sender details.
2) Then ALWAYS call WebSearch with the same topic to get relevant external information.
3) Finally call GenerateFunction with three separate arguments:
   - topic: the original input topic
   - rag_context: the output from RAGTool
   - web_context: the output from WebSearch
4) GenerateFunction should be the last tool call and it should only be called once. DO NOT CALL GenerateFunction MORE THAN ONCE, AFTER YOU CALL IT ONCE RETURN THE OUTPUT.
"""),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
        ("human", "{input}")
    ])

    agent = create_openai_functions_agent(llm=llm, tools=tools, prompt=prompt)
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=False,
        max_iterations=4,
        early_stopping_method="force"
    )
    return agent_executor


def main():
    # Args: <username> <topic>
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate_email.py <username> <topic>"}))
        sys.exit(2)

    username = sys.argv[1]
    topic = " ".join(sys.argv[2:]).strip()

    try:
        load_env_keys()
        vectorstore, persist_dir = build_vectorstore(username)
        agent_executor = create_agent(vectorstore)
        response = agent_executor.invoke({"input": topic})
        # response["output"] should contain the string returned by GenerateFunction
        # which is a JSON string; parse it to ensure valid JSON
        output_str = response.get("output", "{}").strip()
        try:
            data = json.loads(output_str)
        except Exception:
            # If the tool returned JSON string inside text, try to parse
            # or fallback to plain text as body
            data = {"subject": "Generated Email", "body": output_str}

        print(json.dumps({
            "subject": data.get("subject", ""),
            "body": data.get("body", ""),
            "dbPath": persist_dir
        }))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main() 