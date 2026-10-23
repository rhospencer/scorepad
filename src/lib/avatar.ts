/** Seat colors from the design. A player keeps their seat's color on every screen. */
export const SEAT_COLORS = ['#F4B942', '#6FD3C8', '#F28B82', '#9DB7FF', '#C3A3F5', '#A5D96B', '#F5A66D', '#F0A6CA'];

export function seatColor(seat: number): string {
  return SEAT_COLORS[seat % SEAT_COLORS.length];
}

/** First letter of the name, upper-cased. A blank name falls back to the seat number. */
export function initialOf(name: string, seat: number): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : String(seat + 1);
}
