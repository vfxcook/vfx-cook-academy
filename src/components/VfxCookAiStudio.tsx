"use client";

import { useMemo, useState } from "react";

import { StudioCreditCheckoutButton } from "@/components/StudioCreditCheckoutButton";

type StudioPack = {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  amountInr: number;
  providerCostInr: number;
  platformMarginInr: number;
};

type StudioModel = {
  id: string;
  providerModelId: string;
  displayName: string;
  category: string;
  providerCredits: number;
};

type StudioWorkflow = {
  id: string;
  title: string;
  canvasJson: unknown;
  updatedAt: Date | string;
};

type StudioGeneration = {
  id: string;
  prompt: string;
  status: string;
  creditsCharged: number;
  createdAt: Date | string;
  modelPricing?: StudioModel | null;
};

type StudioNode = {
  id: string;
  type: "prompt" | "image" | "video" | "output";
  title: string;
  body: string;
  x: number;
  y: number;
};

const initialNodes: StudioNode[] = [
  {
    id: "prompt-1",
    type: "prompt",
    title: "Prompt",
    body: "A cinematic Malayalam sci-fi street scene at night, volumetric rain, anamorphic lens",
    x: 40,
    y: 90,
  },
  {
    id: "image-1",
    type: "image",
    title: "Image Model",
    body: "Create keyframe / concept art",
    x: 330,
    y: 54,
  },
  {
    id: "video-1",
    type: "video",
    title: "Video Model",
    body: "Animate shot with camera motion",
    x: 620,
    y: 126,
  },
  {
    id: "output-1",
    type: "output",
    title: "Output",
    body: "Save result to Studio history",
    x: 910,
    y: 86,
  },
];

function nodeClass(type: StudioNode["type"]) {
  return `studio-node studio-node-${type}`;
}

export function VfxCookAiStudio({
  balance,
  packs,
  models,
  workflows,
  generations,
}: {
  balance: number;
  packs: StudioPack[];
  models: StudioModel[];
  workflows: StudioWorkflow[];
  generations: StudioGeneration[];
}) {
  const [nodes, setNodes] = useState<StudioNode[]>(initialNodes);
  const [workflowId, setWorkflowId] = useState<string | undefined>(workflows[0]?.id);
  const [workflowTitle, setWorkflowTitle] = useState(workflows[0]?.title ?? "Cinematic AI Shot Workflow");
  const [prompt, setPrompt] = useState(initialNodes[0].body);
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.providerModelId ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedModel = useMemo(
    () => models.find((model) => model.providerModelId === selectedModelId) ?? models[0],
    [models, selectedModelId],
  );

  function addNode(type: StudioNode["type"]) {
    const label = type === "image" ? "Image Model" : type === "video" ? "Video Model" : type === "output" ? "Output" : "Prompt";
    setNodes((current) => [
      ...current,
      {
        id: `${type}-${Date.now()}`,
        type,
        title: label,
        body: type === "prompt" ? "Describe the scene..." : `Configure ${label.toLowerCase()}`,
        x: 80 + current.length * 42,
        y: 120 + current.length * 24,
      },
    ]);
  }

  async function saveWorkflow() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/studio/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        title: workflowTitle,
        canvasJson: { nodes, selectedModelId, prompt },
      }),
    });
    const data = (await response.json()) as { workflow?: { id: string }; error?: string };
    if (!response.ok || !data.workflow) {
      setMessage(data.error ?? "Could not save workflow.");
      setSaving(false);
      return;
    }
    setWorkflowId(data.workflow.id);
    setMessage("Workflow saved.");
    setSaving(false);
  }

  async function runGeneration() {
    if (!selectedModel) {
      setMessage("Choose a model first.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/studio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        providerModelId: selectedModel.providerModelId,
        prompt,
      }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
    if (!response.ok || !data.ok) {
      setMessage(data.error === "INSUFFICIENT_STUDIO_CREDITS" ? "Recharge Studio Credits to run this workflow." : data.error ?? "Could not queue generation.");
      setSaving(false);
      return;
    }
    setMessage(data.message ?? "Generation queued.");
    window.setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="studio-shell">
      <section className="card studio-hero">
        <div>
          <p className="admin-eyebrow">Creators Space</p>
          <h1>VFX COOK AI STUDIO</h1>
          <p className="muted">
            Build AI image and video workflows visually. Credits are purchased through Razorpay and every generation is metered through your VFX COOK account.
          </p>
        </div>
        <div className="studio-balance-card">
          <span>Available Studio Credits</span>
          <strong>{balance.toLocaleString("en-IN")}</strong>
          <small>{selectedModel ? `${selectedModel.displayName}: ${selectedModel.providerCredits} credits/run` : "Add a model to run"}</small>
        </div>
      </section>

      <section className="studio-grid">
        <aside className="card studio-panel">
          <h2>Recharge Credits</h2>
          <div className="studio-pack-grid">
            {packs.map((pack) => (
              <article className="studio-pack-card" key={pack.id}>
                <div>
                  <strong>{pack.name}</strong>
                  <span>{pack.credits.toLocaleString("en-IN")} credits</span>
                </div>
                <p className="muted">
                  Kie cost approx ₹{pack.providerCostInr.toLocaleString("en-IN")} + ₹{pack.platformMarginInr} platform margin.
                </p>
                <div className="studio-pack-price">₹{pack.amountInr.toLocaleString("en-IN")}</div>
                <StudioCreditCheckoutButton packId={pack.id} label="Buy Credits" />
              </article>
            ))}
          </div>
        </aside>

        <section className="card studio-workbench">
          <div className="studio-toolbar">
            <div>
              <p className="admin-eyebrow">Workflow Canvas</p>
              <input
                className="input studio-title-input"
                value={workflowTitle}
                onChange={(event) => setWorkflowTitle(event.target.value)}
                aria-label="Workflow title"
              />
            </div>
            <div className="studio-toolbar-actions">
              <button className="btn btn-secondary" type="button" onClick={() => addNode("prompt")}>
                Add Prompt
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => addNode("image")}>
                Add Image
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => addNode("video")}>
                Add Video
              </button>
              <button className="btn btn-secondary" type="button" onClick={saveWorkflow} disabled={saving}>
                Save
              </button>
            </div>
          </div>

          <div className="studio-canvas" aria-label="VFX COOK AI STUDIO workflow canvas">
            <svg className="studio-connections" aria-hidden="true">
              {nodes.slice(0, -1).map((node, index) => {
                const next = nodes[index + 1];
                return (
                  <line
                    key={`${node.id}-${next.id}`}
                    x1={node.x + 220}
                    y1={node.y + 58}
                    x2={next.x}
                    y2={next.y + 58}
                  />
                );
              })}
            </svg>
            {nodes.map((node) => (
              <article
                className={nodeClass(node.type)}
                key={node.id}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              >
                <span>{node.type}</span>
                <strong>{node.title}</strong>
                <p>{node.body}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="card studio-panel">
          <h2>Run Workflow</h2>
          <label>
            Model
            <select className="select" value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)}>
              {models.map((model) => (
                <option key={model.id} value={model.providerModelId}>
                  {model.displayName} - {model.providerCredits} credits
                </option>
              ))}
            </select>
          </label>
          <label>
            Master Prompt
            <textarea className="textarea" rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <button className="btn btn-primary" type="button" onClick={runGeneration} disabled={saving || !selectedModel}>
            Queue Generation
          </button>
          {message ? <p className="muted">{message}</p> : null}

          <div className="studio-history">
            <h3>Recent Runs</h3>
            {generations.length === 0 ? (
              <p className="muted">No Studio generations yet.</p>
            ) : (
              generations.map((generation) => (
                <article key={generation.id}>
                  <strong>{generation.modelPricing?.displayName ?? "Studio Model"}</strong>
                  <span>{generation.status} - {generation.creditsCharged} credits</span>
                  <p>{generation.prompt.slice(0, 96)}{generation.prompt.length > 96 ? "..." : ""}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
