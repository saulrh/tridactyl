import {testAll, testAllNoError, testAllCustom} from './test_utils'
import * as ks from './keyseq'

function mk(k, mod?) {
    return new ks.MinimalKey(k, mod)
}

testAll(ks.bracketexprToKey2, [
    ['<C-a><CR>', [mk('a', {ctrlKey:true}), '<CR>']],
    ['<M-<>', [mk('<', {metaKey:true}), '']],
    ['<M-<>Foo', [mk('<', {metaKey:true}), 'Foo']],
    ['<M-a>b', [mk('a', {metaKey:true}), 'b']],
    ['<S-Escape>b', [mk('Escape', {shiftKey:true}), 'b']],
    ['<Tab>b', [mk('Tab'), 'b']],
    ['<>b', [mk('<'), '>b']],
    ['<tag >', [mk('<'), 'tag >']],
])

testAllNoError(ks.mapstrToKeyseq, [
    'Some string',
    'hi<c-u>there',
    'wat\'s up <s-Escape>',
])

testAllCustom(ks.mapstrToKeyseq, [
    ['Some string',
        [{"altKey": false, "ctrlKey": false, "key": "S", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "o", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "m", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "e", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": " ", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "s", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "t", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "r", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "i", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "n", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "g", "metaKey": false, "shiftKey": false}]],
    ['hi<c-u>t<A-Enter>here',
        [{"altKey": false, "ctrlKey": false, "key": "h", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "i", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": true, "key": "u", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "t", "metaKey": false, "shiftKey": false},{"altKey": true, "ctrlKey": false, "key": "Enter", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "h", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "e", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "r", "metaKey" : false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "e", "metaKey": false, "shiftKey": false}]],
    ['wat\'s up <s-Escape>',
        [{"altKey": false, "ctrlKey": false, "key": "w", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "a", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "t", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "'", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "s", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": " ", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "u", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "p", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": " ", "metaKey": false, "shiftKey": false}, {"altKey": false, "ctrlKey": false, "key": "Escape", "metaKey": false, "shiftKey": true}]],
], 'toMatchObject', 'ans')
