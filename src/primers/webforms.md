# ASP.NET Web Forms Architectural Primer

You are documenting a C# ASP.NET Web Forms application. Apply this knowledge precisely.

## Layered architecture (STRICT — never skip layers)

```
Page / UserControl  →  Code-Behind (.aspx.cs)  →  Business Logic Layer  →  Data Access Layer  →  Database
```

- **Pages** (`.aspx`) define the declarative UI markup. They never contain business logic.
- **Code-behind files** (`.aspx.cs`) handle page lifecycle events and delegate to the BLL. They do NOT query the database directly.
- **Business Logic Layer** (BLL) classes contain rules, validation, and orchestration. They are plain C# classes, not tied to HTTP.
- **Data Access Layer** (DAL) handles all SQL or ORM interaction. It knows nothing about pages or HTTP.

## Page lifecycle (CRITICAL — document in event order)

The Web Forms request pipeline fires events in this exact order on every POST:

1. `Page_Init` — controls are created, ViewState not yet loaded
2. `Page_Load` — ViewState restored; `IsPostBack` distinguishes first load from postback
3. Control events — e.g. `Button_Click`, `GridView_SelectedIndexChanged`
4. `Page_PreRender` — final state changes before rendering
5. `Page_Unload` — cleanup; response already sent

- `IsPostBack` is `true` for every request after the initial GET. Guard one-time initialization with `if (!IsPostBack)`.
- Control events only fire on postback — they never fire on the initial GET.

## ViewState

- ViewState serializes control values into a hidden field (`__VIEWSTATE`) and restores them on postback.
- Disabling ViewState (`EnableViewState="false"`) reduces page size but requires the code-behind to repopulate controls on every postback.
- ViewState is NOT a session store — it does not persist across page navigations.

## Code-behind class structure

- The code-behind class inherits from `System.Web.UI.Page` (or a custom base page).
- Controls declared in `.aspx` are auto-generated as `protected` fields — accessing them in code-behind is direct field access, not dependency injection.
- Master pages inject a `ContentPlaceHolder`; child pages access master page members via `(Master as SiteMaster)?.SomeProperty`.

## Data binding

- `GridView`, `Repeater`, `DropDownList` bind via `.DataSource` + `.DataBind()`. Both must be called, in that order, every time the data changes.
- `GridView` with `AllowPaging="true"` requires handling `PageIndexChanging` to update `PageIndex` and rebind — the grid does NOT paginate automatically.
- `ObjectDataSource` declaratively wires a control to a BLL method — document the `TypeName`, `SelectMethod`, and any `SelectParameters`.

## Session and state

- `Session["key"]` is per-user, server-side. Always cast and null-check: `Session["cart"] as Cart`.
- `Application["key"]` is global across all users — treat as read-mostly; writes require `Application.Lock()` / `Application.UnLock()`.
- `ViewState["key"]` persists within a page across postbacks only.

## Exception handling

- `Page_Error` on the page or `Application_Error` in `Global.asax` are the global handlers.
- `Server.GetLastError()` retrieves the exception; `Server.ClearError()` marks it as handled.
- Unhandled exceptions redirect to the `customErrors` page configured in `web.config`.

## Master pages

- Master page defines shared layout with `<asp:ContentPlaceHolder>` regions.
- Child pages declare `<%@ Page MasterPageFile="~/Site.Master" %>` and fill `<asp:Content>` blocks.
- The master page's `Page_Load` fires BEFORE the child page's `Page_Load`.

## Common patterns to document accurately

- `DropDownList` bound in `Page_Load` inside `if (!IsPostBack)`: intentional — rebinding on every postback would reset the selected value.
- `Response.Redirect(url)` ends the current request immediately after sending a 302. Code after it does not execute.
- `ScriptManager` + `UpdatePanel`: partial-page postbacks that update only the panel's content. Control events inside an `UpdatePanel` trigger async postbacks, not full page reloads.
- `SqlDataSource` with inline connection strings: a legacy pattern — document the query and parameters, not the connection string value.
- `Eval("FieldName")` inside a `Repeater` or `GridView` template: late-bound data expression evaluated at render time against the current data item.
