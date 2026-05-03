export interface TimeOfDay {
  period: "morning" | "afternoon" | "evening" | "late";
  greeting: string;
  accentHue: number;
}

export function getTimeOfDay(date?: Date): TimeOfDay {
  const d = date ?? new Date();
  const hour = d.getHours();

  if (hour < 5) {
    return {
      period: "late",
      greeting: "Late night?",
      accentHue: 300, // deep violet
    };
  }

  if (hour < 12) {
    return {
      period: "morning",
      greeting: "Morning.",
      accentHue: 45, // warm amber
    };
  }

  if (hour < 18) {
    return {
      period: "afternoon",
      greeting: "Afternoon —",
      accentHue: 140, // green
    };
  }

  if (hour < 22) {
    return {
      period: "evening",
      greeting: "Evening.",
      accentHue: 270, // indigo
    };
  }

  return {
    period: "late",
    greeting: "Late night?",
    accentHue: 300, // deep violet
  };
}
