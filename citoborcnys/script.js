/**
 * @brief Generates a UUID-like identifier for a cheat-sheet item.
 * @return {string} A generated identifier.
 */
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let fileHandle;
let appData = { title: "SyncRobotic cheat sheet", items: [] };

const sidebar = document.getElementById('sidebar');
const content = document.getElementById('content');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

/**
 * @brief Persists the current data to the file selected by the user.
 * @return {Promise<void>} Resolves when the file has been written.
 */
async function saveData() {
    if (!fileHandle) return;
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(appData, null, 2));
    await writable.close();
}

/**
 * @brief Creates a small move button (▲ or ▼) for the sidebar.
 * @param {string} label Button label text.
 * @param {Function} onClick Click handler.
 * @return {HTMLButtonElement} The configured button.
 */
function createMoveBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'move-btn';
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        onClick();
        await saveData();
        render();
    });
    return btn;
}

/**
 * @brief Renders the sidebar and Markdown content from the current data.
 * @return {void}
 */
function render() {
    sidebar.innerHTML = '';
    content.innerHTML = '';
    document.querySelector('h1').textContent = appData.title;
    
    appData.items.forEach((item, index) => {
        // Wrapper row for main link + move buttons
        const itemRow = document.createElement('div');
        itemRow.className = 'sidebar-row';

        // Move-up button for top-level item
        const upBtn = createMoveBtn('▲', () => {
            if (index > 0) {
                [appData.items[index - 1], appData.items[index]] =
                    [appData.items[index], appData.items[index - 1]];
            }
        });
        upBtn.disabled = index === 0;

        // Move-down button for top-level item
        const downBtn = createMoveBtn('▼', () => {
            if (index < appData.items.length - 1) {
                [appData.items[index], appData.items[index + 1]] =
                    [appData.items[index + 1], appData.items[index]];
            }
        });
        downBtn.disabled = index === appData.items.length - 1;

        // Main title link
        const mainLink = document.createElement('a');
        mainLink.href = `#section-${item.id}`;
        mainLink.textContent = item.title;
        mainLink.style.fontWeight = 'bold';
        mainLink.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(`section-${item.id}`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        itemRow.appendChild(upBtn);
        itemRow.appendChild(downBtn);
        itemRow.appendChild(mainLink);
        sidebar.appendChild(itemRow);

        // Section container - use unique ID
        const section = document.createElement('section');
        section.id = `section-${item.id}`;
        
        // 1. Render Markdown to HTML using marked.js
        const htmlContent = marked.parse(item.content);
        
        // 2. Parse HTML using temporary container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // 3. Extract headings for the sidebar and assign collision-free anchors.
        const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const mdHeadings = getMarkdownHeadings(item.content);

        headings.forEach((heading, headingIndex) => {
            const text = heading.textContent;
            const anchorId = `heading-${item.id}-${headingIndex}`;
            heading.id = anchorId;
            
            const level = parseInt(heading.tagName.substring(1), 10);
            const padding = Math.max(0, (level - 1) * 10) + 'px';
            const mdH = mdHeadings[headingIndex];

            // Find previous and next sibling at the same level under the same parent
            const prevSibling = findPrevSibling(mdHeadings, headingIndex);
            const nextSibling = findNextSibling(mdHeadings, headingIndex);

            const headingRow = createSubLink(text, anchorId, padding, mdH, item, prevSibling, nextSibling);
            sidebar.appendChild(headingRow);
        });

        const sectionTitle = document.createElement('h1');
        sectionTitle.textContent = item.title;
        section.appendChild(sectionTitle);
        section.appendChild(tempDiv);
        content.appendChild(section);
    });
}

/**
 * @brief Finds the previous sibling heading at the same level under the same parent.
 * @param {Array<Object>} headings All headings from getMarkdownHeadings.
 * @param {number} idx Index of the current heading.
 * @return {Object|null} The previous sibling heading, or null if none.
 */
function findPrevSibling(headings, idx) {
    const current = headings[idx];
    for (let i = idx - 1; i >= 0; i--) {
        if (headings[i].level === current.level) return headings[i];
        if (headings[i].level < current.level) return null; // crossed parent boundary
    }
    return null;
}

/**
 * @brief Finds the next sibling heading at the same level under the same parent.
 * @param {Array<Object>} headings All headings from getMarkdownHeadings.
 * @param {number} idx Index of the current heading.
 * @return {Object|null} The next sibling heading, or null if none.
 */
function findNextSibling(headings, idx) {
    const current = headings[idx];
    for (let i = idx + 1; i < headings.length; i++) {
        if (headings[i].level === current.level) return headings[i];
        if (headings[i].level < current.level) return null; // crossed parent boundary
    }
    return null;
}

/**
 * @brief Swaps two sibling sections in the Markdown source of an item.
 * @param {Object} item The cheat-sheet item whose content will be mutated.
 * @param {Object} headingA First heading (must have lineIndex and endLineIndex).
 * @param {Object} headingB Second heading (must have lineIndex and endLineIndex).
 * @return {void}
 */
function swapMarkdownSections(item, headingA, headingB) {
    const lines = item.content.split('\n');
    // Ensure A comes before B
    const [first, second] = headingA.lineIndex < headingB.lineIndex
        ? [headingA, headingB]
        : [headingB, headingA];

    const firstLines = lines.slice(first.lineIndex, first.endLineIndex);
    const secondLines = lines.slice(second.lineIndex, second.endLineIndex);
    const between = lines.slice(first.endLineIndex, second.lineIndex);

    lines.splice(
        first.lineIndex,
        second.endLineIndex - first.lineIndex,
        ...secondLines,
        ...between,
        ...firstLines
    );
    item.content = lines.join('\n');
}

/**
 * @brief Creates a sidebar row with move buttons and a link for a Markdown heading.
 * @param {string} text Heading text.
 * @param {string} anchorId Anchor id for the heading element.
 * @param {string} padding Left padding CSS string.
 * @param {Object} mdH Heading metadata from getMarkdownHeadings.
 * @param {Object} item Parent cheat-sheet item.
 * @param {Object|null} prevSibling Previous same-level sibling heading.
 * @param {Object|null} nextSibling Next same-level sibling heading.
 * @return {HTMLDivElement} Row element containing buttons and link.
 */
function createSubLink(text, anchorId, padding, mdH, item, prevSibling, nextSibling) {
    const row = document.createElement('div');
    row.className = 'sidebar-row';
    row.style.paddingLeft = padding;

    const upBtn = createMoveBtn('▲', () => {
        if (prevSibling) swapMarkdownSections(item, mdH, prevSibling);
    });
    upBtn.disabled = !prevSibling;

    const downBtn = createMoveBtn('▼', () => {
        if (nextSibling) swapMarkdownSections(item, mdH, nextSibling);
    });
    downBtn.disabled = !nextSibling;

    const link = document.createElement('a');
    link.href = `#${anchorId}`;
    link.textContent = '└ ' + text;
    link.style.fontSize = '0.9em';
    link.style.color = '#aaa';
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(anchorId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    row.appendChild(upBtn);
    row.appendChild(downBtn);
    row.appendChild(link);
    return row;
}

/**
 * @brief Escapes text before it is interpolated into modal option markup.
 * @param {string} value Text to escape.
 * @return {string} HTML-safe text.
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * @brief Creates options for selecting a top-level cheat-sheet item.
 * @return {string} HTML option elements for the available items.
 */
function getSelectOptions() {
    return appData.items.map(item => (
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`
    )).join('');
}

/**
 * @brief Finds ATX Markdown headings and their editable content ranges.
 *
 * A heading owns every following line up to the next heading at the same or a
 * higher level. Nested headings therefore remain part of their parent section.
 * @param {string} markdown Markdown source to inspect.
 * @return {Array<Object>} Heading metadata, including its source range.
 */
function getMarkdownHeadings(markdown) {
    const lines = markdown.split('\n');
    const headings = [];
    const headingPattern = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/;

    lines.forEach((line, lineIndex) => {
        const match = line.match(headingPattern);
        if (match) {
            headings.push({
                lineIndex,
                level: match[1].length,
                title: match[2].trim(),
                prefix: match[1]
            });
        }
    });

    return headings.map((heading, headingIndex) => {
        const nextBoundary = headings.slice(headingIndex + 1).find(next => next.level <= heading.level);
        return {
            ...heading,
            endLineIndex: nextBoundary ? nextBoundary.lineIndex : lines.length
        };
    });
}

/**
 * @brief Creates grouped Modify-menu options for items and their Markdown headings.
 * @return {string} HTML option and optgroup elements.
 */
function getModifyOptions() {
    return appData.items.map(item => {
        const itemOption = `<option value="item:${escapeHtml(item.id)}">${escapeHtml(item.title)}（完整項目）</option>`;
        const headingOptions = getMarkdownHeadings(item.content).map(heading => {
            const indentation = '　'.repeat(heading.level - 1);
            return `<option value="heading:${escapeHtml(item.id)}:${heading.lineIndex}">${indentation}${heading.prefix} ${escapeHtml(heading.title)}</option>`;
        }).join('');
        return `<optgroup label="${escapeHtml(item.title)}">${itemOption}${headingOptions}</optgroup>`;
    }).join('');
}

/**
 * @brief Resolves the selected Modify-menu value to an item or heading target.
 * @param {string} selection Current selection value.
 * @return {Object|null} The matching edit target, or null when it no longer exists.
 */
function getModifyTarget(selection) {
    const [type, itemId, lineIndex] = selection.split(':');
    const item = appData.items.find(data => data.id === itemId);
    if (!item) return null;

    if (type === 'item') return { type, item };

    const heading = getMarkdownHeadings(item.content)
        .find(candidate => candidate.lineIndex === Number(lineIndex));
    return heading ? { type, item, heading } : null;
}

/**
 * @brief Replaces one Markdown heading and the content it owns.
 * @param {Object} target The heading target returned by getModifyTarget.
 * @param {string} title Replacement heading text.
 * @param {string} sectionContent Replacement section content.
 * @return {void}
 */
function updateMarkdownHeading(target, title, sectionContent) {
    const lines = target.item.content.split('\n');
    const replacement = [`${target.heading.prefix} ${title.trim()}`];
    if (sectionContent !== '') replacement.push(...sectionContent.split('\n'));
    lines.splice(
        target.heading.lineIndex,
        target.heading.endLineIndex - target.heading.lineIndex,
        ...replacement
    );
    target.item.content = lines.join('\n');
}

/**
 * @brief Removes a Markdown heading and the content that belongs to it.
 * @param {Object} target The heading target returned by getModifyTarget.
 * @return {void}
 */
function deleteMarkdownHeading(target) {
    const lines = target.item.content.split('\n');
    lines.splice(
        target.heading.lineIndex,
        target.heading.endLineIndex - target.heading.lineIndex
    );
    target.item.content = lines.join('\n');
}

document.getElementById('loadFileBtn').onclick = async () => {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON File', accept: {'application/json': ['.json']} }]
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        appData = JSON.parse(content);
        
        // Ensure all items have an ID (Migration for old data)
        appData.items.forEach(item => {
            if (!item.id) item.id = uuidv4();
        });
        render();
    } catch (err) {
        console.error('Error loading file:', err);
    }
};

document.getElementById('addBtn').onclick = () => {
    if (!fileHandle) return alert('Please load a file first');
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <label style="display:block">Title</label>
        <input id="newTitle" placeholder="Title" style="width:100%">
        <label style="display:block; margin-top:10px">Content</label>
        <textarea id="newContent" placeholder="Content" style="width:100%; height:400px"></textarea>
        <button id="saveBtn" style="margin-top:10px">Save</button>
    `;
    document.getElementById('saveBtn').onclick = async () => {
        appData.items.push({
            id: uuidv4(),
            title: document.getElementById('newTitle').value, 
            content: document.getElementById('newContent').value
        });
        await saveData();
        render();
        modal.style.display = 'none';
    };
};

document.getElementById('modifyBtn').onclick = () => {
    if (!fileHandle) return alert('Please load a file first');
    if (appData.items.length === 0) return alert('No data to modify');
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <label style="display:block">Select Item</label>
        <select id="modSelect" style="width:100%">${getModifyOptions()}</select>
        <label style="display:block; margin-top:10px">Title</label>
        <input id="modTitle" style="width:100%">
        <label style="display:block; margin-top:10px">Content</label>
        <textarea id="modContent" style="width:100%; height:400px"></textarea>
        <button id="updateBtn" style="margin-top:10px">Update</button>
    `;
    const modSelect = document.getElementById('modSelect');
    const updateFields = () => {
        const target = getModifyTarget(modSelect.value);
        if (!target) return;

        if (target.type === 'item') {
            document.getElementById('modTitle').value = target.item.title;
            document.getElementById('modContent').value = target.item.content;
            return;
        }

        const lines = target.item.content.split('\n');
        document.getElementById('modTitle').value = target.heading.title;
        document.getElementById('modContent').value = lines
            .slice(target.heading.lineIndex + 1, target.heading.endLineIndex)
            .join('\n');
    };
    modSelect.onchange = updateFields;
    updateFields();
    document.getElementById('updateBtn').onclick = async () => {
        const target = getModifyTarget(modSelect.value);
        if (!target) return;

        if (target.type === 'item') {
            target.item.title = document.getElementById('modTitle').value;
            target.item.content = document.getElementById('modContent').value;
        } else {
            updateMarkdownHeading(
                target,
                document.getElementById('modTitle').value,
                document.getElementById('modContent').value
            );
        }
        await saveData();
        render();
        modal.style.display = 'none';
    };
};

document.getElementById('deleteBtn').onclick = () => {
    if (!fileHandle) return alert('Please load a file first');
    if (appData.items.length === 0) return alert('No data to delete');
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <label style="display:block">Select Item or Heading to Delete</label>
        <select id="delSelect" style="width:100%">${getModifyOptions()}</select>
        <button id="confirmDelBtn" style="background:red; margin-top:10px">Confirm Delete</button>
    `;
    document.getElementById('confirmDelBtn').onclick = async () => {
        if(confirm('Are you sure?')) {
            const target = getModifyTarget(document.getElementById('delSelect').value);
            if (!target) return;

            if (target.type === 'item') {
                appData.items = appData.items.filter(data => data.id !== target.item.id);
            } else {
                deleteMarkdownHeading(target);
            }
            await saveData();
            render();
            modal.style.display = 'none';
        }
    };
};

document.querySelector('.close').onclick = () => modal.style.display = 'none';
