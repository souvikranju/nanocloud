# Context Menu Documentation

## Overview

The NanoCloud file browser includes a custom context menu that appears on right-click (desktop) or long-press (mobile/touch devices). This document explains how the context menu works and how to add new menu items.

## Architecture

The context menu system consists of three main components:

### 1. Context Menu Module (`public/assets/js/ui/contextMenu.js`)
- **Purpose**: Core context menu rendering and positioning logic
- **Key Functions**:
  - `initContextMenu()`: Initializes the menu DOM elements
  - `showContextMenu(x, y, items)`: Displays the menu at specified coordinates with given items
  - `hideContextMenu()`: Hides the menu
  - `isContextMenuVisible()`: Checks if menu is currently visible

### 2. List Module (`public/assets/js/ui/list.js`)
- **Purpose**: Builds menu items based on current selection state
- **Key Functions**:
  - `buildContextMenuItems()`: Generates menu configuration array
  - `handleContextMenu(event)`: Desktop right-click handler

### 3. Touch Handlers Module (`public/assets/js/ui/touchHandlers.js`)
- **Purpose**: Mobile/touch interaction logic
- **Key Functions**:
  - `handleTouchStart(event)`: Implements 2-state long-press logic
  - `initTouchHandlers()`: Initializes listeners with Smart Suppression

## Hybrid Device Support (Smart Suppression)

To support hybrid devices (tablets/laptops with both touch and mouse), the system uses **Smart Suppression** for the `contextmenu` event:

1.  Touch handlers are initialized on **all devices**.
2.  A listener captures the `contextmenu` event (usually fired by right-click OR long-press).
3.  The listener checks if a touch interaction is active or finished recently (<500ms).
    - If **Yes** (Touch): It blocks the native context menu, allowing our custom touch logic to handle it.
    - If **No** (Mouse): It lets the event pass, allowing the standard desktop right-click menu to appear.

This ensures seamless operation across mobile, desktop, and hybrid environments without conflicts.

## Desktop Behavior

- **Trigger**: Right-click on any file/folder item
- **Selection Logic**:
  - Right-clicking an unselected item: Selects it exclusively
  - Right-clicking a selected item: Keeps current selection
- **Position**: Menu appears at mouse cursor coordinates
- **Boundary Check**: Menu automatically flips position if near viewport edge

## Mobile/Touch Behavior

The touch interaction uses a **2-state system**:

### State 1: Item Not Selected
- **Action**: Long-press (>500ms) → **Selects the item**
- **Visual Feedback**: Pulse animation during long-press
- **Haptic Feedback**: Vibration on selection (if supported)

### State 2: Item Already Selected
- **Action**: Long-press (>500ms) → **Shows Context Menu**
- **Visual Feedback**: Pulse animation during long-press
- **Haptic Feedback**: Vibration when menu appears

## Adding New Menu Items

To add a new menu item, modify the `buildContextMenuItems()` function in `public/assets/js/ui/list.js`:

### Menu Item Structure

```javascript
{
  label: 'Menu Item Label',      // Display text
  icon: '📁',                     // Emoji or icon
  action: () => { /* ... */ },   // Function to execute
  disabled: false,                // Optional: disable item
  danger: false,                  // Optional: red styling for destructive actions
  separator: false                // Optional: render as separator line
}
```

### Example: Adding a "Copy" Menu Item

```javascript
export function buildContextMenuItems() {
  const selectedItems = getSelectedItems();
  const selectedCount = selectedItems.size;
  const selectedNames = Array.from(selectedItems);
  
  const firstItem = currentItems.find(i => selectedNames.includes(i.name));
  const isSingleSelection = selectedCount === 1;
  
  const items = [];
  
  // ... existing items (Open, Download, etc.)
  
  // Add new Copy item
  items.push({
    label: 'Copy',
    icon: '📋',
    action: () => {
      // Implement copy logic here
      copySelectedItems();
    },
    disabled: false  // Set to true to disable
  });
  
  // ... rest of menu items
  
  return items;
}
```

### Menu Item Types

#### 1. Action Item
```javascript
{
  label: 'Action Name',
  icon: '🔧',
  action: () => performAction()
}
```

#### 2. Disabled Item
```javascript
{
  label: 'Unavailable Action',
  icon: '🚫',
  action: () => {},
  disabled: true
}
```

#### 3. Dangerous Action (Red styling)
```javascript
{
  label: 'Delete',
  icon: '🗑️',
  action: deleteSelectedItems,
  danger: true
}
```

#### 4. Separator
```javascript
{
  separator: true
}
```

### Conditional Menu Items

You can conditionally include menu items based on selection state:

```javascript
// Only show for single file selection
if (isSingleSelection && !isFolder) {
  items.push({
    label: 'Preview',
    icon: '👁️',
    action: () => previewFile(firstItem)
  });
}

// Only show for multiple selections
if (selectedCount > 1) {
  items.push({
    label: `Compress ${selectedCount} items`,
    icon: '🗜️',
    action: compressSelectedItems
  });
}
```

### Checking Permissions

Always check operation permissions before enabling menu items:

```javascript
const copyCheck = isOperationAllowed('copy');
items.push({
  label: 'Copy',
  icon: '📋',
  action: copySelectedItems,
  disabled: !copyCheck.allowed
});
```

## Styling

The context menu uses CSS classes defined in `public/assets/css/components.css`:

- `.context-menu`: Main container
- `.context-menu-item`: Individual menu item
- `.context-menu-item.danger`: Destructive action styling
- `.context-menu-icon`: Icon container
- `.context-menu-label`: Text label
- `.context-menu-separator`: Separator line

### Customizing Appearance

To customize the menu appearance, modify the CSS in `components.css`:

```css
.context-menu {
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  /* Add your custom styles */
}

.context-menu-item:hover:not(:disabled) {
  background: var(--primary-50);
  color: var(--primary-700);
  /* Add your custom hover styles */
}
```

## Best Practices

1. **Keep Actions Simple**: Menu actions should be quick and non-blocking
2. **Use Clear Labels**: Make menu item labels descriptive and concise
3. **Group Related Items**: Use separators to group related actions
4. **Check Permissions**: Always verify operation permissions before enabling items
5. **Provide Feedback**: Use toast notifications to confirm actions
6. **Handle Errors**: Wrap actions in try-catch blocks and show error messages

## Example: Complete Menu Item Addition

```javascript
// In buildContextMenuItems() function

// Check if operation is allowed
const shareCheck = isOperationAllowed('share');

// Add the menu item
items.push({
  label: isSingleSelection ? 'Share' : `Share ${selectedCount} items`,
  icon: '🔗',
  action: async () => {
    try {
      await shareSelectedItems();
      showSuccess('Share link created!');
    } catch (err) {
      showError(`Failed to share: ${err.message}`);
    }
  },
  disabled: !shareCheck.allowed
});
```

## Future Enhancements

Potential improvements to the context menu system:

- Nested submenus
- Keyboard navigation
- Custom icons (beyond emojis)
- Context-aware menu items based on file type
- Plugin system for third-party menu items
