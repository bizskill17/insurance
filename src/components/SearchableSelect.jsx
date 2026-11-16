import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";

function optionText(children) {
  if (Array.isArray(children)) {
    return children.map(optionText).join("");
  }

  if (children === null || children === undefined || typeof children === "boolean") {
    return "";
  }

  if (isValidElement(children)) {
    return optionText(children.props.children);
  }

  return String(children);
}

// Long lists (e.g. thousands of clients) only draw this many matches; typing narrows the list.
const MAX_RENDERED_OPTIONS = 200;

function buildOptions(children) {
  return Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === "option")
    .map((child, index) => {
      const label = optionText(child.props.children).trim() || String(child.props.value ?? "");
      const description = String(child.props["data-description"] ?? "").trim();
      const searchText = String(child.props["data-search-text"] ?? `${label} ${description}`)
        .trim()
        .toLowerCase();

      return {
        // The position is always part of the key: two options can share a value or key
        // (e.g. two customers with the same name), and duplicate keys leave wrong rows on screen when searching.
        key: `${child.key !== null && child.key !== undefined ? String(child.key) : String(child.props.value ?? "")}-${index}`,
        value: String(child.props.value ?? ""),
        label,
        description,
        searchText,
        disabled: Boolean(child.props.disabled)
      };
    });
}

export default function SearchableSelect({
  value = "",
  onChange,
  children,
  disabled = false,
  required = false,
  placeholder = "Select",
  className = "",
  name,
  id,
  onSearchChange,
  emptyMessage = "No matching options.",
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState({});
  const options = useMemo(() => buildOptions(children), [children]);
  const stringValue = String(value ?? "");
  const selectedOption = options.find((option) => option.value === stringValue);
  const placeholderOption = options.find((option) => option.value === "");
  const visibleOptions = useMemo(() => options.filter((option) => option.value !== ""), [options]);
  const resolvedPlaceholder = placeholderOption?.label || placeholder;
  const selectedLabel = stringValue ? selectedOption?.label || stringValue : resolvedPlaceholder;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return visibleOptions;
    }

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    return visibleOptions.filter((option) => queryTokens.every((token) => option.label.normalize("NFKC").toLocaleLowerCase().includes(token)));
  }, [query, visibleOptions]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePanelPosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportPadding = 8;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openAbove = spaceBelow < 190 && spaceAbove > spaceBelow;
      const availableSpace = Math.max(130, openAbove ? spaceAbove : spaceBelow);
      const listMaxHeight = Math.max(90, Math.min(260, availableSpace - 68));

      setPanelStyle({
        left: `${rect.left}px`,
        width: `${Math.max(rect.width, 180)}px`,
        top: openAbove ? "auto" : `${rect.bottom + 8}px`,
        bottom: openAbove ? `${window.innerHeight - rect.top + 8}px` : "auto",
        "--searchable-select-list-max": `${listMaxHeight}px`
      });
    };

    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    updatePanelPosition();
    window.setTimeout(() => {
      updatePanelPosition();
      searchRef.current?.focus();
    }, 0);

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen]);

  const openDropdown = () => {
    setQuery("");
    onSearchChange?.("");
    setIsOpen(true);
  };

  const emitChange = (nextValue) => {
    onChange?.({
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name }
    });
  };

  const handleSelect = (option) => {
    if (option.disabled) {
      return;
    }

    emitChange(option.value);
    setIsOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`searchable-select ${isOpen ? "searchable-select--open" : ""} ${disabled ? "searchable-select--disabled" : ""} ${className}`.trim()}
    >
      <select
        {...props}
        id={selectId}
        name={name}
        value={stringValue}
        required={required}
        disabled={disabled}
        className="searchable-select__native"
        onChange={(event) => emitChange(event.target.value)}
        onInvalid={() => {
          openDropdown();
          window.setTimeout(() => searchRef.current?.focus(), 0);
        }}
      >
        {/* Only the empty and the selected option are needed here: the hidden native select
            exists for form validation, and drawing thousands of options would slow the page. */}
        <option value="">{resolvedPlaceholder}</option>
        {selectedOption && selectedOption.value !== "" ? (
          <option value={selectedOption.value}>{selectedOption.label}</option>
        ) : null}
      </select>
      <button
        type="button"
        className={`searchable-select__trigger ${!stringValue ? "searchable-select__trigger--placeholder" : ""}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-listbox`}
        onClick={() => { if (isOpen) setIsOpen(false); else openDropdown(); }}
      >
        <span className="searchable-select__value">{selectedLabel}</span>
        <span className="searchable-select__chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="searchable-select__panel" style={panelStyle}>
          <input
            ref={searchRef}
            type="search"
            className="searchable-select__search"
            value={query}
            placeholder="Search..."
            onInput={(event) => {
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              onSearchChange?.(nextQuery);
            }}
            onChange={(event) => {
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              onSearchChange?.(nextQuery);
            }}
          />
          <div id={`${selectId}-listbox`} className="searchable-select__list" role="listbox">
            {filteredOptions.length ? (
              filteredOptions.slice(0, MAX_RENDERED_OPTIONS).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`searchable-select__option ${option.value === stringValue ? "searchable-select__option--selected" : ""}`.trim()}
                  disabled={option.disabled}
                  role="option"
                  aria-selected={option.value === stringValue}
                  onClick={() => handleSelect(option)}
                >
                  <span className="searchable-select__option-content">
                    <span className="searchable-select__option-label">{option.label}</span>
                    {option.description ? (
                      <span className="searchable-select__option-description">{option.description}</span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="searchable-select__empty">
                {query.trim() ? "No matching options." : emptyMessage}
              </div>
            )}
            {filteredOptions.length > MAX_RENDERED_OPTIONS ? (
              <div className="searchable-select__empty">
                Showing {MAX_RENDERED_OPTIONS} of {filteredOptions.length.toLocaleString("en-IN")}. Type to search.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
