export const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid transparent",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s, box-shadow 0.2s",
  outline: "none",
  lineHeight: 1.5,
};

export const buttonDisabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

export const googleButtonStyle: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: "#fff",
  color: "#1f1f1f",
  border: "1px solid #dadce0",
  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
};

export const facebookButtonStyle: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: "#0866ff",
  color: "#fff",
};

export const containerCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "24px",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  backgroundColor: "var(--venm-bg, #fff)",
  maxWidth: "400px",
};

export const containerVertical: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "400px",
};

export const containerHorizontal: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "12px",
  flexWrap: "wrap",
};

export const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  color: "#6b7280",
  fontSize: "12px",
  width: "100%",
};

export const spinnerStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  border: "2px solid #5f6368",
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: "venm-spin 0.6s linear infinite",
  display: "inline-block",
};

export const spinnerLightStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  animation: "venm-spin 0.6s linear infinite",
  display: "inline-block",
};
