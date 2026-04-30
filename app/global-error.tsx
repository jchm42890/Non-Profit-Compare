"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "12px" }}>
          Something went wrong
        </h2>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          A temporary error occurred. Please try again.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: "24px", fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{ padding: "8px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
