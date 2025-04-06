
export const getEmojiForProduct = (name: string): string => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("batata")) return "🥔";
    if (nameLower.includes("abóbora")) return "🎃";
    if (nameLower.includes("brócolis")) return "🥦";
    if (nameLower.includes("arroz")) return "🍚";
    if (nameLower.includes("risoto")) return "🍝";
    if (nameLower.includes("milho")) return "🌽";
    if (nameLower.includes("picadinho")) return "🍖";
    if (nameLower.includes("tropical")) return "🌴";
    if (nameLower.includes("panqueca")) return "🥞";
    if (nameLower.includes("waffle")) return "🧇";
    if (nameLower.includes("pão")) return "🍞";
    if (nameLower.includes("macarrão")) return "🍝";
    return "🍽️";
  };