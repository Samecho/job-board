import type { StructuredResume } from "../types";

export const completeResume: StructuredResume = {
  header: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 416 555 0100",
    location: "Toronto, ON",
    linkedin: "https://linkedin.com/in/ada_lovelace",
    github: "https://github.com/ada-lovelace",
    website: "https://ada.example.com/path?a=1&b=2",
  },
  education: [{
    institution: "University of British Columbia",
    location: "Vancouver, BC",
    degree: "BASc in Computer Engineering",
    dates: "Sep. 2024 -- Expected May 2029",
    details: ["Dean's List", "Coursework: Operating Systems & Distributed Systems"],
  }],
  experience: [
    {
      organization: "Ericsson",
      title: "Automation Co-op, MLOps and Agentic AI",
      location: "Ottawa, ON",
      dates: "May 2026 -- Present",
      type: "work",
      subprojects: [
        {
          name: "Agentic Operations Intelligence Platform",
          bullets: [
            { text: "Engineered a modular Python agent runtime with structured tool calling and streaming.", highlights: ["Python", "structured tool calling"] },
            { text: "Built FastAPI services handling 1M events daily with OpenTelemetry tracing across 12 services.", highlights: ["FastAPI", "1M events"] },
          ],
        },
        {
          name: "TR Impact Analyzer",
          bullets: [
            { text: "Automated Kubernetes canary deployments reducing rollout time by 40%.", highlights: ["Kubernetes"] },
            { text: "Improved numerical agreement to 1.2×10−16 while preserving ± tolerance, and x ≤ y ≥ z.", highlights: ["1.2×10−16"] },
          ],
        },
      ],
    },
    {
      organization: "University of British Columbia",
      title: "Undergraduate Researcher",
      location: "Vancouver, BC",
      dates: "Dec. 2025 -- Present",
      type: "research",
      subprojects: [
        {
          name: "Distributed Systems Research Project",
          bullets: [
            { text: "Designed reproducible distributed-systems experiments on 80-node cluster.", highlights: ["80-node cluster"] },
            { text: "Co-authored an artifact evaluated on 80 nodes with x ≤ y ≥ z and R&D_50% costs.", highlights: ["x ≤ y ≥ z"] },
          ],
        },
      ],
    },
  ],
  projects: [{
    name: "Vector Search Engine",
    technologies: ["Rust", "CUDA"],
    dates: "2026",
    bullets: [
      { text: "Implemented HNSW indexing for million-vector datasets.", highlights: ["HNSW"] },
      { text: "Benchmarked recall and latency against FAISS.", highlights: ["FAISS"] },
    ],
  }],
  technicalSkills: {
    languages: ["Go", "Rust", "Python", "C++"],
    frameworks: ["React", "FastAPI"],
    developerTools: ["Docker", "Kubernetes", "Terraform", "GitHub Actions"],
    libraries: ["PyTorch", "NumPy"],
  },
};
