/* eslint-env jquery */
import { stateToHTML } from 'draft-js-export-html';

( function( window ) {
  function createTableRichTextEditor() {
    const RichTextEditor = window.Handsontable.editors.BaseEditor.prototype.extend();

    RichTextEditor.prototype.beginEditing = function() {
      const initialCellValue = this.instance.getValue();
      let contentState;
      const blocksFromHTML = initialCellValue ? window.DraftJS.convertFromHTML( initialCellValue ) : null;
      if ( blocksFromHTML && blocksFromHTML.contentBlocks ) {
        contentState = window.DraftJS.ContentState.createFromBlockArray( blocksFromHTML.contentBlocks, blocksFromHTML.entityMap );
      } else {
        contentState = window.DraftJS.ContentState.createFromText( '' );
      }

      const cellValue = window.DraftJS.convertToRaw( contentState );
      if ( cellValue.entityMap ) {
        for ( const entity in cellValue.entityMap ) {
          if ( cellValue.entityMap[entity] && cellValue.entityMap[entity].data ) {
            cellValue.entityMap[entity].data.url = cellValue.entityMap[entity].data.href;
            if ( cellValue.entityMap[entity].data.url.startsWith( '/documents/' ) ) {
              cellValue.entityMap[entity].type = 'DOCUMENT';
            }
          }
        }
      }
      const cellProperties = this.cellProperties;
      const instance = this.instance;

      instance.deselectCell();
      const modalDom = showModal();
      const editorHtml = _createRichTextEditor( cellValue );

      modalDom.on( 'save-btn:clicked', function() {
        const editorValue = editorHtml.value;
        let html;

        /* If editor is empty then set html to null becasue some 3rd parrty helper
            functions don't play nicely with empty valu cells */
        if ( !editorValue || editorValue === 'null' ) {
          html = null;
        } else {
          const raw = JSON.parse( editorValue );
          const state = window.DraftJS.convertFromRaw( raw );
          const options = {
            entityStyleFn: entity => {
              const entityType = entity.get( 'type' ).toLowerCase();
              if ( entityType === 'document' ) {
                const data = entity.getData();
                return {
                  element: 'a',
                  attributes: {
                    'href': data.url,
                    'data-linktype': 'DOCUMENT',
                    'data-id': data.id,
                    'type': 'DOCUMENT'
                  },
                  style: {
                  }
                };
              }
              return null;
            }
          };
          html = stateToHTML( state, options );
        }

        instance.setDataAtCell( cellProperties.row, cellProperties.col, html );
        instance.render();
      } );

    };

    // Put editor in dedicated namespace
    window.Handsontable.editors.RichTextEditor = RichTextEditor;

    // Register alias
    window.Handsontable.editors.registerEditor('richtext', RichTextEditor);

    
  }

  function setCustomContextMenus(){
    window.Handsontable.hooks.add('afterMergeCells', function(cellRange, mergeParent, auto) {
      saveMergeCellInformation(this, cellRange, mergeParent);
    })
    window.Handsontable.hooks.add('beforeContextMenuSetItems', function(items) {

      // Add richtext edit option in right click menu
      var richtextMenu = items.find((item) => item.name == "richtext");
      if (richtextMenu) {
        richtextMenu.name = "Open richtext editor";
        richtextMenu.key = "richtext";
        richtextMenu.callback = makeEditorRichText;
      }

      // Add background color to cells
      var colorMenu = items.find((item) => item.name == "color");
      if (colorMenu) {
        colorMenu.name = "Add background color";
        colorMenu.key = "color";
        colorMenu.submenu = {
          items: [{
            key: 'color:blue',
            name: 'Blue',
            callback: setCellColor
          }, {
            key: 'color:green',
            name: 'Green',
            callback: setCellColor
          }, {
            key: 'color:yellow',
            name: 'Yellow',
            callback: setCellColor
          },{
            key: 'color:teal-dark',
            name: 'Teal Dark',
            callback: setCellColor
          },{
            key: 'color:teal-medium',
            name: 'Teal Medium',
            callback: setCellColor
          },{
            key: 'color:teal-light',
            name: 'Teal Light',
            callback: setCellColor
          }
            ]
        }
      }
    });
  }

  function saveMergeCellInformation(hot, cellRange, mergeParent) {
    let oldClassName = hot.getCellMeta(mergeParent.row, mergeParent.col).className;
    let mergeClassName = `rowspan-${mergeParent.rowspan} colspan-${mergeParent.colspan}`;
    if (oldClassName) {
      oldClassName = oldClassName.replace(/rowspan-\d+/g, "").replace(/colspan-\d+/g, "").trim()
      mergeClassName = oldClassName + " " + mergeClassName;
    }
    hot.setCellMeta(mergeParent.row, mergeParent.col, 'className', mergeClassName)
    for(var i = 1; i < mergeParent.rowspan; i++) {
      hot.setCellMeta((mergeParent.row + i), mergeParent.col, 'className', 'hidden')
    }
    for(var i = 1; i < mergeParent.colspan; i++) {
      hot.setCellMeta(mergeParent.row, mergeParent.col + i, 'className', 'hidden')
    }
    hot.render()
  }

  function makeEditorRichText(key, selection, clickEvent) {
    this.setCellMeta(selection[0].start.row, selection[0].start.col, 'editor', 'richtext');
    this.selectCell(selection[0].start.row, selection[0].start.col);
    this.getActiveEditor().beginEditing();
  }

  function setCellColor(key, opt) {
  	let color = key.substring(6);
  	for (let i = opt[0].start.row; i <= opt[0].end.row; i++) {
      for (let j = opt[0].start.col; j <= opt[0].end.col; j++) {
        this.setCellMeta(i, j, 'className', color);
        this.render();
      }
    }
  }



  function showModal( ) {
    let modalDom;
    let modalBodyDom;
    let bodyDom = null;
    let saveBtnDom;

    // Set header template.
    const MODAL_BODY_TEMPLATE = [
      '<header class="nice-padding hasform">',
      '<div class="row">',
      '<div class="left">',
      '<div class="col">',
      '<h1 class="icon icon-table">Edit Table Cell</h1>',
      '</div>',
      '</div>',
      '</div>',
      '</header>',
      '<div class="row active nice-padding struct-block object">',
      '<label class="hidden" for="table-block-editor">Table Cell Input</label>',
      '<input class="hidden" id="table-block-editor" maxlength="255" name="title" type="text" value="" class="data-draftail-input">',
      '</div><br>',
      '<div class="row active nice-padding m-t-10">',
      '<label class="hidden" for="table-block-save-btn">Save</label>',
      '<button id="table-block-save-btn" type="button" data-dismiss="modal" class="button">Save Button</button>',
      '</div>'
    ].join( '' );

    // Set body template.
    const MODAL_TEMPLATE = [
      '<div class="table-block-modal fade"',
      'tabindex="-1" role="dialog" aria-hidden="true">',
      '<div class="modal-dialog">',
      '<div class="modal-content">',
      '<label class="hidden" for="close-table-block-modal-btn">Close Modal Button</label>',
      '<button id="close-table-block-modal-btn" type="button" class="button close icon text-replace icon-cross"',
      'data-dismiss="modal" aria-hidden="true">×</button>',
      '<div class="modal-body"></div>',
      '</div>',
      '</div>'
    ].join( '' );

    modalDom = $( MODAL_TEMPLATE );
    modalBodyDom = modalDom.find( '.modal-body' );
    modalBodyDom.html( MODAL_BODY_TEMPLATE );
    bodyDom = $( 'body' );
    bodyDom.find( '.table-block-modal' ).remove();
    bodyDom.append( modalDom );
    modalDom.modal( 'show' );
    saveBtnDom = modalDom.find( '#table-block-save-btn' );
    saveBtnDom.on( 'click', function( event ) {
      modalDom.trigger( 'save-btn:clicked', event );
    } );

    return modalDom;
  }

  /*  createRichTextEditor

      Code copied from
      https://github.com/wagtail/wagtail/blob/master/wagtail/admin/
      static_src/wagtailadmin/js/hallo-bootstrap.js

      Modifications were made to add new form fields to the TableBlock in Wagtail admin and support the rich text editor within table cells.
      TODO: Refactor this code and submit PR to Wagtail repo. */
  function _createRichTextEditor( initialValue ) {
    const id = 'table-block-editor';
    const editor = $( '#' + id ).attr( 'value', JSON.stringify( initialValue ) );

    window.draftail.initEditor(
      '#' + id,
      {
        entityTypes: [
          {
            type: 'LINK',
            icon: 'link',
            description: 'Link',
            attributes: [ 'url', 'id', 'parentId' ],
            whitelist: { href: '^(http:|https:|undefined$)' }
          },
          {
            type: 'DOCUMENT',
            icon: 'doc-full',
            description: 'Document'
          },
          {
            type: 'IMAGE',
            icon: 'image',
            description: 'Image'
          }
        ],
        enableHorizontalRule: false,
        enableLineBreak: false,
        inlineStyles: [
          {
            type: 'BOLD',
            icon: 'bold',
            description: 'Bold'
          },
          {
            type: 'ITALIC',
            icon: 'italic',
            description: 'Italic'
          }
        ],
        blockTypes: [
          {
            label: 'H3',
            type: 'header-three',
            description: 'Heading 3'
          },
          {
            label: 'H4',
            type: 'header-four',
            description: 'Heading 4'
          },
          {
            label: 'H5',
            type: 'header-five',
            description: 'Heading 5'
          },
          {
            type: 'ordered-list-item',
            icon: 'list-ol',
            description: 'Numbered list'
          },
          {
            type: 'unordered-list-item',
            icon: 'list-ul',
            description: 'Bulleted list'
          }
        ]
      },
      document.currentScript
    );

    const html = editor[0];

    return html;
  }

  function renderMergedCells(id) {
    const $cell = $("#" + id + "-handsontable-container td[class*='rowspan-']");
    if ($cell.length) {
      $cell.each(function() {
        var $c = $(this);
        const classes = $c.attr('class').split(' ');
        const rowspan_list = classes.filter((className) => (className.startsWith('rowspan-')));
        const rowspan = parseInt(rowspan_list[0].replace('rowspan-', ''));
        const colspan_list = classes.filter((className) => (className.startsWith('colspan-')));
        const colspan = parseInt(colspan_list[0].replace('colspan-', ''));
        $c.attr('rowspan', rowspan);
        $c.attr('colspan', colspan);
      });
    }
  }

  function persistMergedCells(id) {
    window.onload = function(){
      renderMergedCells(id);
    }
    $('#' + id + '-handsontable-header').on('change', function() {
      renderMergedCells(id);
    });
    $('#' + id + '-handsontable-col-header').on('change', function() {
      renderMergedCells(id);
    });
    $('#' + id + '-handsontable-col-caption').on('change', function() {
      renderMergedCells(id);
    });
    window.Handsontable.hooks.add('afterDeselect', function() {
      renderMergedCells(id);
    });
    window.Handsontable.hooks.add('afterRender', function() {
      renderMergedCells(id);
    });
  }

  function makeTableSortable(id) {
    var tableInitialValue = JSON.parse($('#' + id).val());
    if (tableInitialValue && tableInitialValue["columnSorting"]) {
      $('#' + id + '-handsontable-sortable').prop("checked", true)
    }
    $('#' + id + '-handsontable-sortable').on('click', function() {
      var tableValue = JSON.parse($('#' + id).val());
      if (tableValue) {
        tableValue["columnSorting"] = $(this).is(':checked');
        $('#' + id).val(JSON.stringify(tableValue));
      }
    });

    $('#' + id + '-handsontable-header').on('change', function() {
      persistSortable(id);
    });
    $('#' + id + '-handsontable-col-header').on('change', function() {
      persistSortable(id);
    });
    $('#' + id + '-handsontable-col-caption').on('change', function() {
      persistSortable(id);
    });
    window.Handsontable.hooks.add('afterDeselect', function() {
      persistSortable(id);
    });
  }

  function persistSortable(id) {
    var tableValue = JSON.parse($('#' + id).val());
    if (tableValue) {
      tableValue["columnSorting"] = $('#' + id + '-handsontable-sortable').is(':checked');
      $('#' + id).val(JSON.stringify(tableValue));
    }
  }
  
  window.makeTableSortable = makeTableSortable;
  window.createTableRichTextEditor = createTableRichTextEditor;
  window.setCustomContextMenus = setCustomContextMenus;
  window.persistMergedCells = persistMergedCells;


  // Create a new richtext table input widget
  class RichTextTableInput {
    constructor(options, strings) {
      this.options = options;
      this.strings = strings;
    }
  
    render(placeholder, name, id, initialState) {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="field boolean_field widget-checkbox_input">
          <label for="${id}-handsontable-sortable">Sortable table</label>
          <div class="field-content">
              <div class="input">
                  <input type="checkbox"
                        id="${id}-handsontable-sortable"
                        name="handsontable-sortable">
              </div>
              <p class="help">Enable sortable table functionality.</p>
          </div>
        </div>
        <div class="field boolean_field widget-checkbox_input">
          <label for="${id}-handsontable-header">${this.strings['Row header']}</label>
          <div class="field-content">
            <div class="input">
              <input type="checkbox" id="${id}-handsontable-header" name="handsontable-header" />
            </div>
            <p class="help">${this.strings['Display the first row as a header.']}</p>
          </div>
        </div>
        <br/>
        <div class="field boolean_field widget-checkbox_input">
          <label for="${id}-handsontable-col-header">${this.strings['Column header']}</label>
          <div class="field-content">
            <div class="input">
              <input type="checkbox" id="${id}-handsontable-col-header" name="handsontable-col-header" />
            </div>
            <p class="help">${this.strings['Display the first column as a header.']}</p>
          </div>
        </div>
        <br/>
        <div class="field">
            <label for="${id}-handsontable-col-caption">${this.strings['Table caption']}</label>
            <div class="field-content">
              <div class="input">
              <input type="text" id="${id}-handsontable-col-caption" name="handsontable-col-caption" />
            </div>
            <p class="help">
              ${this.strings['A heading that identifies the overall topic of the table, and is useful for screen reader users']}
            </p>
          </div>
        </div>
        <br/>
        <div id="${id}-handsontable-container"></div>
        <input type="hidden" name="${name}" id="${id}" placeholder="${this.strings['Table']}">
      `;
      placeholder.replaceWith(container);
  
      const input = container.querySelector(`input[name="${name}"]`);
      const options = this.options;
  
      const widget = {
        getValue() {
          return JSON.parse(input.value);
        },
        getState() {
          return JSON.parse(input.value);
        },
        setState(state) {
          input.value = JSON.stringify(state);
          setCustomContextMenus();
          createTableRichTextEditor();
          initTable(id, options);
          makeTableSortable(id);
          persistMergedCells(id);
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        focus() {},
      };
      widget.setState(initialState);
      return widget;
    }
  }
  window.telepath.register('wagtail.widgets.RichTextTableInput', RichTextTableInput);
})( window );