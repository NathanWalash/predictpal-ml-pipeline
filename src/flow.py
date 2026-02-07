import streamlit as st
import streamlit.components.v1 as components

STEP_CONFIG = [
    {"key": "welcome", "label": "Welcome", "path": "pages/1_Welcome.py"},
    {"key": "get_started", "label": "Get Started", "path": "pages/2_Get_Started.py"},
    {"key": "process_data", "label": "Process Data", "path": "pages/3_Process_Data.py"},
    {"key": "train_forecast", "label": "Train & Forecast", "path": "pages/4_Train_Forecast.py"},
    {"key": "outputs", "label": "Outputs", "path": "pages/5_Outputs.py"},
    {"key": "showcase", "label": "Showcase", "path": "pages/6_Showcase.py"},
]


def init_flow_state() -> None:
    if "flow_started" not in st.session_state:
        st.session_state["flow_started"] = False
    if "max_unlocked_step" not in st.session_state:
        st.session_state["max_unlocked_step"] = 0
    if "debug_mode" not in st.session_state:
        st.session_state["debug_mode"] = False


def hide_default_sidebar_nav() -> None:
    st.markdown(
        """
<style>
section[data-testid="stSidebar"] { display: none !important; }
button[kind="header"][aria-label="Open sidebar"] { display: none !important; }
button[kind="header"][aria-label="Close sidebar"] { display: none !important; }
div[data-testid="stSidebarCollapsedControl"] { display: none !important; }
[data-testid="stAppViewContainer"] { margin-left: 0 !important; }

.process-jump-title {
    margin-top: 0.55rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #87a8c6;
    letter-spacing: 0.03em;
    text-transform: uppercase;
}
</style>
""",
        unsafe_allow_html=True,
    )


def start_flow() -> None:
    st.session_state["flow_started"] = True
    st.session_state["max_unlocked_step"] = max(st.session_state["max_unlocked_step"], 1)


def guard_step(current_step: int) -> None:
    init_flow_state()

    if current_step == 0:
        return
    if st.session_state["debug_mode"]:
        return

    if not st.session_state["flow_started"]:
        st.switch_page(STEP_CONFIG[0]["path"])

    max_step = st.session_state["max_unlocked_step"]
    if current_step > max_step:
        st.switch_page(STEP_CONFIG[max_step]["path"])


def unlock_step(step_index: int) -> None:
    st.session_state["max_unlocked_step"] = max(st.session_state["max_unlocked_step"], step_index)


def render_top_process_nav(current_step: int) -> None:
    if current_step <= 0:
        return

    steps = STEP_CONFIG[1:]
    max_step = len(steps) if st.session_state["debug_mode"] else st.session_state["max_unlocked_step"]
    progress = current_step / len(steps)
    progress_percent = int(progress * 100)

    step_nodes = []
    for idx, step in enumerate(steps, start=1):
        state = "upcoming"
        if idx <= max_step:
            state = "available"
        if idx < current_step:
            state = "done"
        elif idx == current_step:
            state = "current"

        step_nodes.append(
            f"""
<div class="step {state}">
  <div class="dot">{idx}</div>
  <div class="label">{step["label"]}</div>
</div>
"""
        )

    html = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
.flow-wrap {{
  font-family: 'Space Grotesk', sans-serif;
  border: 1px solid #35506b;
  border-radius: 18px;
  padding: 14px 14px 14px 14px;
  background:
    radial-gradient(circle at 8% 0%, #1f3042 0%, rgba(31, 48, 66, 0) 34%),
    linear-gradient(180deg, #121c29 0%, #0d1621 100%);
}}
.flow-top {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}}
.flow-title {{
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #b8d1eb;
  text-transform: uppercase;
}}
.flow-count {{
  font-size: 12px;
  font-weight: 700;
  color: #d8e8f8;
  background: #1b2c3e;
  border: 1px solid #35516f;
  border-radius: 999px;
  padding: 2px 8px;
}}
.bar {{
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #24374d;
  overflow: hidden;
  margin-bottom: 12px;
}}
.bar-fill {{
  width: {progress_percent}%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #1f74d1 0%, #25a3d6 100%);
}}
.steps {{
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}}
.step {{
  border-radius: 12px;
  border: 1px solid #2e435b;
  padding: 8px;
  background: #152232;
  text-align: center;
  position: relative;
}}
.step:not(:last-child)::after {{
  content: "";
  position: absolute;
  right: -8px;
  top: 22px;
  width: 8px;
  height: 2px;
  background: #3f5873;
}}
.dot {{
  width: 28px;
  height: 28px;
  border-radius: 50%;
  margin: 0 auto 6px auto;
  line-height: 28px;
  font-size: 13px;
  font-weight: 700;
}}
.label {{
  font-size: 11px;
  font-weight: 600;
  color: #9cb7d1;
  min-height: 20px;
}}
.step.done {{
  background: #12251c;
  border-color: #2b5e45;
}}
.step.done .dot {{
  background: #1f8f58;
  color: #ffffff;
}}
.step.current {{
  background: #122235;
  border-color: #2f5f94;
}}
.step.current .dot {{
  background: #1f74d1;
  color: #ffffff;
}}
.step.available {{
  background: #172739;
  border-color: #3f5873;
}}
.step.available .dot {{
  background: #3a5673;
  color: #d2e4f5;
}}
.step.upcoming {{
  background: #152232;
  border-color: #2e435b;
}}
.step.upcoming .dot {{
  background: #31465d;
  color: #a8bed3;
}}
@media (max-width: 900px) {{
  .steps {{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }}
  .step:not(:last-child)::after {{
    display: none;
  }}
}}
</style>
<div class="flow-wrap">
  <div class="flow-top">
    <div class="flow-title">Forecast Build Flow</div>
    <div class="flow-count">Step {current_step} / {len(steps)}</div>
  </div>
  <div class="bar"><div class="bar-fill"></div></div>
  <div class="steps">{''.join(step_nodes)}</div>
</div>
"""
    components.html(html, height=210, scrolling=False)


def render_debug_tools(current_step: int) -> None:
    init_flow_state()
    is_debug = st.session_state["debug_mode"]
    max_step = st.session_state["max_unlocked_step"]

    with st.expander("Debug Tools", expanded=False):
        toggle_label = "Disable Debug Mode" if is_debug else "Enable Debug Mode"
        if st.button(toggle_label, key=f"debug_toggle_{current_step}", use_container_width=True):
            st.session_state["debug_mode"] = not is_debug
            st.rerun()

        st.caption("Debug mode unlocks free navigation to any step.")
        cols = st.columns(len(STEP_CONFIG))
        for idx, step in enumerate(STEP_CONFIG):
            disabled = False
            if not st.session_state["debug_mode"]:
                disabled = idx > max_step and idx != 0
            with cols[idx]:
                if st.button(
                    step["label"],
                    key=f"debug_jump_{current_step}_{step['key']}",
                    use_container_width=True,
                    disabled=disabled,
                ):
                    st.switch_page(step["path"])
