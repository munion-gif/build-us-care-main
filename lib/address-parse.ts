export function parseAddressDong(addressFull: string): string | null {
  const dongMatch = addressFull.match(/([가-힣]+동)(?:\s|$)/);
  return dongMatch ? dongMatch[1] : null;
}

export function parseAddressApt(addressFull: string): string | null {
  const aptMatch = addressFull.match(/([가-힣a-zA-Z0-9]+(?:아파트|단지|빌라|오피스텔|타운|마을)[가-힣a-zA-Z0-9]*)/);
  return aptMatch ? aptMatch[1] : null;
}
