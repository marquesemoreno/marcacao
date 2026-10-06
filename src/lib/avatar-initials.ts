/** Iniciais do avatar: primeira letra das 2 primeiras palavras que têm letra. Nome que é
 * só telefone ("(77) 99939-5571") volta vazio — o avatar mostra um ícone no lugar de "(9". */
export function avatarInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.match(/\p{L}/u)?.[0])
    .filter((c): c is string => !!c)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
