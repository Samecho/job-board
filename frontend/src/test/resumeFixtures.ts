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
    institution: "University of Toronto",
    location: "Toronto, ON",
    degree: "BASc in Computer Engineering",
    dates: "2024 -- 2028",
    details: ["Dean's List", "Coursework: Operating Systems & Distributed Systems"],
  }],
  experience: [
    {
      organization: "Example Cloud",
      title: "Software Engineer Intern",
      location: "Toronto, ON",
      dates: "May 2026 -- Aug 2026",
      type: "work",
      bullets: [
        "Built a Go service processing 2M events per day.",
        "Reduced p95 latency by 38% with Redis caching.",
        "Added OpenTelemetry tracing across 12 services.",
        "Automated canary deployments with Kubernetes.",
      ],
    },
    {
      organization: "Systems Research Lab",
      title: "Undergraduate Researcher",
      location: "Toronto, ON",
      dates: "Sep 2025 -- Present",
      type: "research",
      bullets: ["Designed reproducible distributed-systems experiments.", "Co-authored an artifact evaluated on 80 nodes."],
    },
  ],
  projects: [{
    name: "Vector Search Engine",
    technologies: ["Rust", "CUDA"],
    dates: "2026",
    bullets: ["Implemented HNSW indexing for million-vector datasets.", "Benchmarked recall and latency against FAISS."],
  }],
  technicalSkills: {
    languages: ["Go", "Rust", "Python", "C++"],
    frameworks: ["React", "FastAPI"],
    developerTools: ["Docker", "Kubernetes", "Terraform", "GitHub Actions"],
    libraries: ["PyTorch", "NumPy"],
  },
};
