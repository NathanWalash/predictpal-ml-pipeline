import streamlit as st


def apply_ui_theme() -> None:
    st.markdown(
        """
<style>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap');

:root {
    --bg-1: #0a111b;
    --bg-2: #0d1621;
    --bg-3: #162536;
    --ink-1: #e7f0fb;
    --ink-2: #bfd0e3;
    --ink-3: #dbe9f8;
    --line: #2f455c;
    --primary: #2f7ef5;
    --primary-2: #37c2ff;
    --ok: #2fb879;
}

html, body, [class*="css"] {
    font-family: "Manrope", sans-serif;
}

[data-testid="stAppViewContainer"] {
    background:
        radial-gradient(circle at 0% 0%, #162738 0%, rgba(22, 39, 56, 0) 36%),
        radial-gradient(circle at 100% 0%, #1a2736 0%, rgba(26, 39, 54, 0) 30%),
        linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 42%);
}

.block-container {
    padding-top: 0.8rem;
    padding-bottom: 2.2rem;
    max-width: 1080px;
}

header[data-testid="stHeader"] {
    display: none !important;
}

h1, h2, h3 {
    color: var(--ink-1);
    letter-spacing: -0.01em;
}

p, label, .stMarkdown, .stCaption {
    color: var(--ink-2);
}

small, span {
    color: var(--ink-2);
}

.ui-banner {
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 1rem 1.1rem;
    margin-bottom: 1.2rem;
    background:
        radial-gradient(circle at 100% 0%, #1a2b3d 0%, rgba(26, 43, 61, 0) 36%),
        linear-gradient(180deg, #1a2b3d 0%, #122133 100%);
}

.ui-banner .eyebrow {
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: #8ab2d8;
}

.ui-banner .title {
    margin-top: 0.25rem;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--ink-1);
}

.ui-banner .subtitle {
    margin-top: 0.3rem;
    font-size: 1rem;
    color: #b9cee3;
}

.ui-card {
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 1rem 1rem 0.5rem 1rem;
    background: linear-gradient(180deg, #22384d 0%, #1a2d41 100%);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.2);
    margin-bottom: 0.55rem;
}

.ui-card .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--ink-1);
}

.ui-card .card-sub {
    margin-top: 0.2rem;
    margin-bottom: 0.35rem;
    font-size: 0.92rem;
    color: #b6cce1;
}

div[data-testid="stTextInput"] > label,
div[data-testid="stTextArea"] > label,
div[data-testid="stSelectbox"] > label,
div[data-testid="stFileUploader"] > label,
div[data-testid="stSlider"] > label,
div[data-testid="stMultiSelect"] > label,
div[data-testid="stRadio"] > label {
    color: #d2e4f6;
    font-weight: 700;
}

div[data-testid="stTextInput"] input,
div[data-testid="stTextArea"] textarea {
    color: #f1f7ff;
    border-radius: 12px;
    border: 1px solid #456585;
    background: #17283a;
}

div[data-testid="stTextInput"] input:focus,
div[data-testid="stTextArea"] textarea:focus {
    border-color: #53a8ed;
    box-shadow: 0 0 0 1px #53a8ed;
}

div[data-testid="stSelectbox"] div[data-baseweb="select"] > div,
div[data-testid="stMultiSelect"] div[data-baseweb="select"] > div {
    border-radius: 12px;
    border: 1px solid #456585;
    background: #17283a;
    color: #f1f7ff;
}

div[data-testid="stFileUploader"] section {
    border-radius: 12px;
    border: 1px dashed #46709c;
    background: #17283a;
}

div[data-testid="stForm"] {
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 0.65rem 0.85rem 0.25rem 0.85rem;
    background: linear-gradient(180deg, #22384d 0%, #1a2d41 100%);
    margin-bottom: 0.75rem;
}

div[data-testid="stAlert"] {
    border-radius: 12px;
    border-color: #35567a;
    background: #1a2f45;
    color: #cde0f3;
}

button[kind="primary"] {
    background: linear-gradient(90deg, var(--primary) 0%, var(--primary-2) 100%);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-weight: 800;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}

button[kind="secondary"] {
    border-radius: 12px;
    border: 1px solid #4b6b8b;
    background: #20364c;
    color: #f0f6ff;
    font-weight: 700;
}

button[kind="tertiary"] {
    border-radius: 12px;
    border: 1px solid #4b6b8b;
    background: #20364c;
    color: #f0f6ff;
    font-weight: 700;
}

.stButton > button {
    min-height: 2.5rem;
}

.stButton > button p,
button[kind="primary"] p,
button[kind="secondary"] p,
button[kind="tertiary"] p {
    color: inherit !important;
    font-weight: inherit !important;
}

div[data-testid="stForm"] + div[data-testid="stVerticalBlock"] {
    margin-top: 0.2rem;
}

[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stAlert"]) {
    margin-top: 0.35rem;
    margin-bottom: 0.45rem;
}

hr {
    margin-top: 1rem !important;
    margin-bottom: 0.9rem !important;
    border-color: #2b4259 !important;
}
</style>
""",
        unsafe_allow_html=True,
    )


def render_page_banner(eyebrow: str, title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="ui-banner">
  <div class="eyebrow">{eyebrow}</div>
  <div class="title">{title}</div>
  <div class="subtitle">{subtitle}</div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_card_intro(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="ui-card">
  <div class="card-title">{title}</div>
  <div class="card-sub">{subtitle}</div>
</div>
""",
        unsafe_allow_html=True,
    )
