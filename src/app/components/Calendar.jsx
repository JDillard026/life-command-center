const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCalendarDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const numberOfDaysInMonth = new Date(year, month + 1, 0).getDate();

  const leadingEmptyDays = Array(firstDayOfMonth).fill(null);
  const monthDays = Array.from({ length: numberOfDaysInMonth }, (_, index) => index + 1);

  return [...leadingEmptyDays, ...monthDays];
}

export default function Calendar() {
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const today = now.getDate();
  const days = getCalendarDays(now);

  return (
    <section aria-label="Calendar">
      <h2>{monthLabel}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.5rem",
          maxWidth: "420px",
        }}
      >
        {WEEK_DAYS.map((weekDay) => (
          <strong key={weekDay}>{weekDay}</strong>
        ))}

        {days.map((day, index) => {
          if (!day) {
            return <span key={`empty-${index}`} aria-hidden="true" />;
          }

          const isToday = day === today;

          return (
            <span
              key={day}
              style={{
                textAlign: "center",
                borderRadius: "8px",
                padding: "0.5rem 0",
                backgroundColor: isToday ? "#2563eb" : "#f3f4f6",
                color: isToday ? "#fff" : "#111827",
                fontWeight: isToday ? 700 : 500,
              }}
            >
              {day}
            </span>
          );
        })}
      </div>
    </section>
  );
}
