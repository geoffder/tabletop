import type { Attachment } from 'svelte/attachments'

// Holds the tallest height so a line wrapping for a long name does not move the board. A new width
// starts over a frame later, so the observer never re-enters its own change.
export const holdTallest: Attachment<HTMLElement> = (node) => {
    // Reading the width here would force a layout of the page while it is still being built.
    let width = -1
    let tallest = 0
    let frame = 0

    const hold = () => {
        const height = node.offsetHeight
        if (height <= tallest) return
        tallest = height
        const style = getComputedStyle(node)
        const frameHeight =
            style.boxSizing === 'content-box'
                ? parseFloat(style.paddingTop) +
                  parseFloat(style.paddingBottom) +
                  parseFloat(style.borderTopWidth) +
                  parseFloat(style.borderBottomWidth)
                : 0
        node.style.minHeight = `${height - frameHeight}px`
    }

    const observer = new ResizeObserver(() => {
        if (width < 0) {
            width = node.clientWidth
            hold()
            return
        }
        if (node.clientWidth === width) {
            hold()
            return
        }
        width = node.clientWidth
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
            tallest = 0
            node.style.minHeight = ''
            hold()
        })
    })
    observer.observe(node)

    return () => {
        observer.disconnect()
        cancelAnimationFrame(frame)
    }
}
