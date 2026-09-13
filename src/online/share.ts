/**
 * Getting a room link onto someone else's phone.
 *
 * The Clipboard API only exists in a secure context, which `http://<LAN-IP>`
 * is not — exactly the address people use when testing on their own network.
 * So there is a second path through a hidden textarea, and a third where the
 * caller shows the link for copying by hand. Nothing is ever swallowed.
 */

export type ShareResult = 'shared' | 'copied' | 'manual'

export const roomLink = (code: string) => `${location.origin}/?room=${code}`

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* denied or insecure context — try the old way */
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0'
    document.body.appendChild(field)
    field.select()
    field.setSelectionRange(0, text.length)
    const done = document.execCommand('copy')
    field.remove()
    return done
  } catch {
    return false
  }
}

/**
 * Copies the link first — so it is on the clipboard even when the share sheet
 * is dismissed — then offers the native sheet where the platform has one.
 */
export async function shareRoom(code: string, title: string): Promise<ShareResult> {
  const url = roomLink(code)
  const copied = await copyToClipboard(url)

  if (navigator.share) {
    try {
      await navigator.share({ title, text: `${title}: ${code}`, url })
      return 'shared'
    } catch {
      /* the user dismissed the sheet, or the browser refused it */
    }
  }

  return copied ? 'copied' : 'manual'
}
