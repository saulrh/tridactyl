/** Hint links.

    TODO:

    important
        Connect to input system
        Gluing into tridactyl
    unimportant
        Frames
        Redraw on reflow
*/

import * as DOM from './dom'
import {log} from './math'
import {permutationsWithReplacement, islice, izip, map} from './itertools'
import {hasModifiers} from './keyseq'
import state from './state'
import {messageActiveTab} from './messaging'
import * as config from './config'
import * as TTS from './text_to_speech'

/** Simple container for the state of a single frame's hints. */
class HintState {
    public focusedHint: Hint
    readonly hintHost = document.createElement('div')
    constructor(){
        this.hintHost.classList.add("TridactylHintHost")
    }
    readonly hints: Hint[] = []
    public filter = ''
    public hintchars = ''

    destructor() {
        // Undo any alterations of the hinted elements
        for (const hint of this.hints) {
            hint.hidden = true
        }

        // Remove all hints from the DOM.
        this.hintHost.remove()
    }
}

let modeState: HintState = undefined

/** For each hintable element, add a hint */
export function hintPage(
    hintableElements: Element[],
    onSelect: HintSelectedCallback,
    names = hintnames(hintableElements.length),
) {
    state.mode = 'hint'
    modeState = new HintState()
    for (let [el, name] of izip( hintableElements, names)) {
		let nhint = new HintFilteredTargetText(el, name, onSelect)
        modeState.hintchars += nhint.filter_chars
        modeState.hints.push(nhint)
    }

    if (modeState.hints.length) {
        console.log("HINTS", modeState.hints)
        modeState.focusedHint = modeState.hints[0]
        modeState.focusedHint.focused = true
        document.body.appendChild(modeState.hintHost)
    } else {
        reset()
    }
}

/** vimperator-style minimal hint names */
function* hintnames(n: number, hintchars = config.get("hintchars")): IterableIterator<string> {
    let taglen = 1
    var source = permutationsWithReplacement(hintchars, taglen)
    for (let i = 0;i < Math.floor(n / hintchars.length);i++) {
        // drop hints that will be used as the prefix of longer hints
        if (source.next()['done']) {
            // if the current taglen tags are exhausted, increase the length
            taglen++
            source = permutationsWithReplacement(hintchars, taglen)
            source.next()
        }
    }
    while (true) {
        yield* map(source, e=>{
            return e.join('')
        })
        taglen++
        source = permutationsWithReplacement(hintchars, taglen)
    }
}

/** Uniform length hintnames */
function* hintnames_uniform(n: number, hintchars = config.get("hintchars")): IterableIterator<string> {
    if (n <= hintchars.length)
        yield* islice(hintchars[Symbol.iterator](), n)
    else {
        // else calculate required length of each tag
        const taglen = Math.ceil(log(n, hintchars.length))
        // And return first n permutations
        yield* map(islice(permutationsWithReplacement(hintchars, taglen), n),
            perm => {
                return perm.join('')
            })
    }
}

type HintSelectedCallback = (Hint) => any

/** Place a flag by each hintworthy element */
abstract class Hint {
    protected readonly flag = document.createElement('span')

    constructor(
        protected readonly target: Element,
        protected readonly onSelect: HintSelectedCallback
    ) {
        const rect = target.getClientRects()[0]
        this.flag.className = 'TridactylHint'
        /* this.flag.style.cssText = ` */
        /*     top: ${rect.top}px; */
        /*     left: ${rect.left}px; */
        /* ` */
        this.flag.style.cssText = `
            top: ${window.scrollY + rect.top}px;
            left: ${window.scrollX + rect.left}px;
        `
        modeState.hintHost.appendChild(this.flag)
        target.classList.add('TridactylHintElem')
    }

    // These styles would be better with pseudo selectors. Can we do custom ones?
    // If not, do a state machine.
    set hidden(hide: boolean) {
        this.flag.hidden = hide
        if (hide) {
            this.focused = false
            this.target.classList.remove('TridactylHintElem')
        } else
            this.target.classList.add('TridactylHintElem')
    }

    set focused(focus: boolean) {
        if (focus) {
            this.target.classList.add('TridactylHintActive')
            this.target.classList.remove('TridactylHintElem')
        } else {
            this.target.classList.add('TridactylHintElem')
            this.target.classList.remove('TridactylHintActive')
        }
    }

    select() {
        this.onSelect(this)
    }

	abstract in_filter(filter_string: string): boolean;
	abstract get filter_chars(): string;
}

class HintFilteredTargetText extends Hint {
    constructor(
        protected readonly target: Element,
		readonly name: string,
        protected readonly onSelect: HintSelectedCallback
    ) {
		super(target, onSelect)
        this.flag.textContent = name
        // console.log({this.target, this.name})
    }

	protected get filterable_string(): string {
		let nodename = this.target.nodeName.toLowerCase()
		if (nodename == 'input') {
			// } else if (nodename == 'a'
			// 		   && !el.textContent.trim()
			// 		   && el.firstElementChild
			// 		   && el.firstElementChild.nodeName.toLowerCase() == 'img') {
			// 	return el.firstElementChild.alt || el.firstElementChild.title
		} else if (0 < this.target.textContent.length) {
			return this.target.textContent.toLowerCase()
		} else if (this.target.hasAttribute('title')) {
			return this.target.getAttribute('title').toLowerCase()
		} else {
			return this.target.innerHTML.toLowerCase()
		}
	}

	get filter_chars(): string {
		return this.name + this.filterable_string
	}

	in_filter(filter_string: string): boolean {
		return this.in_name(filter_string) && this.in_filterable_string(filter_string)
	}

	protected in_name(filter_string: string): boolean {
		// FIXME: will break on ] and similar regex control characters
		let filter_string_name = filter_string.replace(new RegExp('[^' + this.name + ']', 'gi'), '')
		return this.name.startsWith(filter_string_name)
	}

	protected in_filterable_string(filter_string: string): boolean {
		let cur_idx = 0
		// FIXME: will break on ] and similar regex control characters
		// FIXME: need to pull the full list of configured filter characters
		let filter_string_non_name = filter_string.replace(new RegExp('[' + this.name + ']', 'gi'), '')
		for (let c of filter_string_non_name) {
			cur_idx = this.filterable_string.indexOf(c.toLowerCase(), cur_idx)
			if (-1 == cur_idx) {
				return false
			}
		}
		return true
	}
}

class HintLiteralNames extends Hint {
	constructor (
		protected readonly target: Element,
		readonly name: string,
		protected readonly onSelect: HintSelectedCallback
	) {
		super(target, onSelect)
		this.flag.textContent = name
	}

	get filter_chars(): string {
		return this.name
	}

	in_filter(filter_string: string): boolean {
		return this.name.startsWith(filter_string)
	}
}

/** Show only hints prefixed by fstr. Focus first match */
function filter(fstr) {
    const active: Hint[] = []
    let foundMatch
    for (let h of modeState.hints) {
        if (!h.in_filter(fstr)) h.hidden = true
        else {
            if (! foundMatch) {
                h.focused = true
                modeState.focusedHint = h
                foundMatch = true
            }
            h.hidden = false
            active.push(h)
        }

    }
    if (active.length == 1) {
        selectFocusedHint()
    }
}

/** Remove all hints, reset STATE. */
function reset() {
    modeState.destructor()
    modeState = undefined
    state.mode = 'normal'
}

/** If key is in hintchars, add it to filtstr and filter */
function pushKey(ke) {
    if (hasModifiers(ke)) {
        return
    } else if (ke.key === 'Backspace') {
        modeState.filter = modeState.filter.slice(0,-1)
        filter(modeState.filter)
    } else if (ke.key.length > 1) {
        return
    } else if (modeState.hintchars.includes(ke.key)) {
        modeState.filter += ke.key
        filter(modeState.filter)
    }
}

/** Array of hintable elements in viewport

    Elements are hintable if
        1. they can be meaningfully selected, clicked, etc
        2. they're visible
            1. Within viewport
            2. Not hidden by another element
*/
function hintables(selectors=HINTTAGS_selectors) {
    return DOM.getElemsBySelector(selectors, [DOM.isVisible])
}

function elementswithtext() {

    return DOM.getElemsBySelector("*",
        [DOM.isVisible, hint => {
            return hint.textContent != ""
        }]
    )
}

/** Get array of images in the viewport
 */
function hintableImages() {
    return DOM.getElemsBySelector(HINTTAGS_img_selectors, [DOM.isVisible])
}

/** Get arrat of "anchors": elements which have id or name and can be addressed
 * with the hash/fragment in the URL
 */
function anchors() {
    return DOM.getElemsBySelector(HINTTAGS_anchor_selectors, [DOM.isVisible])
}

// CSS selectors. More readable for web developers. Not dead. Leaves browser to care about XML.
const HINTTAGS_selectors = `
input:not([type=hidden]):not([disabled]),
a,
area,
iframe,
textarea,
button,
select,
summary,
[onclick],
[onmouseover],
[onmousedown],
[onmouseup],
[oncommand],
[role='link'],
[role='button'],
[role='checkbox'],
[role='combobox'],
[role='listbox'],
[role='listitem'],
[role='menuitem'],
[role='menuitemcheckbox'],
[role='menuitemradio'],
[role='option'],
[role='radio'],
[role='scrollbar'],
[role='slider'],
[role='spinbutton'],
[role='tab'],
[role='textbox'],
[role='treeitem'],
[class*='button'],
[tabindex]
`

const HINTTAGS_img_selectors = `
img,
[src]
`

const HINTTAGS_anchor_selectors = `
[id],
[name]
`

import {activeTab, browserBg, l, firefoxVersionAtLeast} from './lib/webext'

async function openInBackground(url: string) {
    const thisTab = await activeTab()
    const options: any = {
        active: false,
        url,
        index: thisTab.index + 1,
    }
    if (await l(firefoxVersionAtLeast(57))) options.openerTabId = thisTab.id
    return browserBg.tabs.create(options)
}

/** if `target === _blank` clicking the link is treated as opening a popup and is blocked. Use webext API to avoid that. */
function simulateClick(target: HTMLElement) {
    // target can be set to other stuff, and we'll fail in annoying ways.
    // There's no easy way around that while this code executes outside of the
    // magic 'short lived event handler' context.
    //
    // OTOH, hardly anyone uses that functionality any more.
    if ((target as HTMLAnchorElement).target === '_blank' ||
        (target as HTMLAnchorElement).target === '_new'
    ) {
        browserBg.tabs.create({url: (target as HTMLAnchorElement).href})
    } else {
        DOM.mouseEvent(target, "click")
        // Sometimes clicking the element doesn't focus it sufficiently.
        target.focus()
    }
}

function hintPageOpenInBackground() {
    hintPage(hintables(), hint=>{
        hint.target.focus()
        if (hint.target.href) {
            // Try to open with the webext API. If that fails, simulate a click on this page anyway.
            openInBackground(hint.target.href).catch(()=>simulateClick(hint.target))
        } else {
            // This is to mirror vimperator behaviour.
            simulateClick(hint.target)
        }
    })
}

function hintPageSimple(selectors=HINTTAGS_selectors) {
    hintPage(hintables(selectors), hint=>{
        simulateClick(hint.target)
    })
}

function hintPageTextYank() {
    hintPage(elementswithtext(), hint=>{
        messageActiveTab("commandline_frame", "setClipboard", [hint.target.textContent])
    })
}

function hintPageYank() {
    hintPage(hintables(), hint=>{
        messageActiveTab("commandline_frame", "setClipboard", [hint.target.href])
    })
}

/** Hint anchors and yank the URL on selection
 */
function hintPageAnchorYank() {

    hintPage(anchors(), hint=>{

        let anchorUrl = new URL(window.location.href)

        anchorUrl.hash = hint.target.id || hint.target.name;

        messageActiveTab("commandline_frame", "setClipboard", [anchorUrl.href])
    })
}

/** Hint images, opening in the same tab, or in a background tab
 *
 * @param inBackground  opens the image source URL in a background tab,
 *                      as opposed to the current tab
 */
function hintImage(inBackground) {
    hintPage(hintableImages(), hint=>{
        let img_src = hint.target.getAttribute("src")

        if (inBackground) {
            openInBackground(new URL(img_src, window.location.href).href)
        } else {
            window.location.href = img_src
        }
    })
}

/** Hint elements to focus */
function hintFocus() {
    hintPage(hintables(), hint=>{
        hint.target.focus()
    })
}

/** Hint items and read out the content of the selection */
function hintRead() {
    hintPage(elementswithtext(), hint=>{
        TTS.readText(hint.target.textContent)
    })
}

function selectFocusedHint() {
    console.log("Selecting hint.", state.mode)
    const focused = modeState.focusedHint
    reset()
    focused.select()
}

import {addListener, attributeCaller} from './messaging'
addListener('hinting_content', attributeCaller({
    pushKey,
    selectFocusedHint,
    reset,
    hintPageSimple,
    hintPageYank,
    hintPageTextYank,
    hintPageAnchorYank,
    hintPageOpenInBackground,
    hintImage,
    hintFocus,
    hintRead,
}))
