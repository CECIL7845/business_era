"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en-GH">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Businestra is having trouble</h1>
        <p>Please refresh the page in a moment.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
      </body>
    </html>
  );
}
