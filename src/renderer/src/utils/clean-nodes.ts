export function cleanNodeName(name: string): string {
  if (!name || typeof name !== 'string') return name

  // Strip promotional brackets and common ad words
  const cleaned = name
    .replace(/【[^】]*】/g, '')
    .replace(/\[(?!(?:HK|US|SG|JP|TW|KR|UK|DE|FR|RU|SG|CA|AU|GB|CN|IN)\b)[^\]]*\]/gi, '')
    .replace(
      /(?:官网|最新|永久|网址|限时|折扣|倍率|剩余|流量|到期|重置|群组|通知|频道|发布页|防失联)[^\s-]*/gi,
      ''
    )
    .replace(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/gi, '')
    .replace(/[|｜•·_\-—]+(?:\s*[|｜•·_\-—]+)+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-_—|｜•·]+|[\s\-_—|｜•·]+$/g, '')
    .trim()

  return cleaned.length > 0 ? cleaned : name
}

export function cleanProxiesList<T extends { name: string }>(proxies: T[]): T[] {
  if (!Array.isArray(proxies)) return proxies
  return proxies.map((proxy) => {
    if (proxy && typeof proxy.name === 'string') {
      return {
        ...proxy,
        name: cleanNodeName(proxy.name)
      }
    }
    return proxy
  })
}
