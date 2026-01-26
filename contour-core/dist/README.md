
# contour-core Browser Bundle

## Usage

### In HTML (ES6 Modules)

```html
<script type="module">
  import contourCore from './contour-core.browser.js';

  // Use contourCore...
</script>
```

### In HTML (Script Tag)

```html
<script src="./contour-core.browser.js"></script>
<script>
  // contourCore is available globally
  const result = contourCore.computeContours(grid, options);
</script>
```

## Files

- `contour-core.browser.js` - Browser bundle (this file)
- Includes all dependencies (no external deps needed)

## Example

See `../demo.html` for usage examples.
