import "./style.css";
import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

class Boundary extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };
  static getDerivedStateFromError(e: Error) {
    return { message: e.message };
  }
  render() {
    return this.state.message ? (
      <main role="alert">
        <h1>AceVoice needs to restart</h1>
        <p>{this.state.message}</p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
