import { CoreSetup, CoreStart, Plugin } from '../../../src/core/public';
import { GetExcelReportPanelAction } from './get_excel_report_panel_action';
import { UiActionsSetup, UiActionsStart } from 'src/plugins/ui_actions/public';
import { CONTEXT_MENU_TRIGGER } from '../../../src/plugins/embeddable/public';

export interface SavedSearchExcelExportPluginSetupDendencies {
  uiActions: UiActionsSetup;
}

export interface SavedSearchExcelExportPluginStartDendencies {
  uiActions: UiActionsStart;
}

export class SavedSearchExcelExportPlugin
  implements
    Plugin<
      void,
      void,
      SavedSearchExcelExportPluginSetupDendencies,
      SavedSearchExcelExportPluginStartDendencies
    > {
  public setup(core: CoreSetup<SavedSearchExcelExportPluginSetupDendencies>, { uiActions }: SavedSearchExcelExportPluginSetupDendencies) {
    const action = new GetExcelReportPanelAction(core);
    uiActions.registerAction(action);
    uiActions.attachAction(CONTEXT_MENU_TRIGGER, action.id);
    uiActions.addTriggerAction(CONTEXT_MENU_TRIGGER, action);
  }

  public start(core: CoreStart, plugins: SavedSearchExcelExportPluginSetupDendencies) {}

  public stop() {}
}
