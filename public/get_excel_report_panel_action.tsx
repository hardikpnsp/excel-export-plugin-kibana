/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import dateMath from '@elastic/datemath';
import _ from 'lodash';
import moment from 'moment-timezone';
import { CoreSetup } from 'src/core/public';
import { writeFile, read } from 'xlsx';
import {
  ISearchEmbeddable,
  SEARCH_EMBEDDABLE_TYPE,
} from '../../../src/plugins/discover/public';
import { IEmbeddable, ViewMode } from '../../../src/plugins/embeddable/public';
import {
  IncompatibleActionError,
  UiActionsActionDefinition as ActionDefinition,
} from '../../../src/plugins/ui_actions/public';
import { API_GENERATE_IMMEDIATE, EXCEL_REPORTING_ACTION } from '../common/constants';

function isSavedSearchEmbeddable(
  embeddable: IEmbeddable | ISearchEmbeddable
): embeddable is ISearchEmbeddable {
  return embeddable.type === SEARCH_EMBEDDABLE_TYPE;
}

interface ActionContext {
  embeddable: ISearchEmbeddable;
}

export class GetExcelReportPanelAction implements ActionDefinition<ActionContext> {
  private isDownloading: boolean;
  public readonly type = '';
  public readonly id = EXCEL_REPORTING_ACTION;
  private canDownloadExcel: boolean = false;
  private core: CoreSetup;

  constructor(core: CoreSetup) {
    this.isDownloading = false;
    this.core = core;
    this.canDownloadExcel = true;
  }

  public getIconType() {
    return 'document';
  }

  public getDisplayName() {
    return 'Download as Excel';
  }

  public getSearchRequestBody({ searchEmbeddable }: { searchEmbeddable: any }) {
    const adapters = searchEmbeddable.getInspectorAdapters();
    if (!adapters) {
      return {};
    }

    if (adapters.requests.requests.length === 0) {
      return {};
    }

    return searchEmbeddable.getSavedSearch().searchSource.getSearchRequestBody();
  }

  public isCompatible = async (context: ActionContext) => {
    if (!this.canDownloadExcel) {
      return false;
    }

    const { embeddable } = context;

    return embeddable.getInput().viewMode !== ViewMode.EDIT && embeddable.type === 'search';
  };

  public execute = async (context: ActionContext) => {
    const { embeddable } = context;

    if (!isSavedSearchEmbeddable(embeddable)) {
      throw new IncompatibleActionError();
    }

    if (this.isDownloading) {
      return;
    }

    const {
      timeRange: { to, from },
    } = embeddable.getInput();

    const searchEmbeddable = embeddable;
    const searchRequestBody = await this.getSearchRequestBody({ searchEmbeddable });
    const state = _.pick(searchRequestBody, ['sort', 'docvalue_fields', 'query']);
    const kibanaTimezone = this.core.uiSettings.get('dateFormat:tz');

    const id = `search:${embeddable.getSavedSearch().id}`;
    const timezone = kibanaTimezone === 'Browser' ? moment.tz.guess() : kibanaTimezone;
    const fromTime = dateMath.parse(from);
    const toTime = dateMath.parse(to, { roundUp: true });

    if (!fromTime || !toTime) {
      return this.onGenerationFail(
        new Error(`Invalid time range: From: ${fromTime}, To: ${toTime}`)
      );
    }

    const body = JSON.stringify({
      timerange: {
        min: fromTime.format(),
        max: toTime.format(),
        timezone,
      },
      state,
    });

    this.isDownloading = true;

    this.core.notifications.toasts.addSuccess({
      title: `Excel Download Started`,
      text:`Your Excel will download momentarily.`,
      'data-test-subj': 'excelDownloadStarted',
    });

    await this.core.http
      .post(`${API_GENERATE_IMMEDIATE}/${id}`, { body })
      .then((rawResponse: string) => {
        this.isDownloading = false;

        const workbook = read(rawResponse, { type: 'string', raw: true });
        writeFile(workbook, 'amr.xlsx', { type: 'binary' });

        const download = `${embeddable.getSavedSearch().title}.csv`;
        const blob = new Blob([rawResponse], { type: 'text/csv;charset=utf-8;' });

        // Hack for IE11 Support
        if (window.navigator.msSaveOrOpenBlob) {
          return window.navigator.msSaveOrOpenBlob(blob, download);
        }

        const a = window.document.createElement('a');
        const downloadObject = window.URL.createObjectURL(blob);

        a.href = downloadObject;
        a.download = download;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadObject);
        document.body.removeChild(a);
      })
      .catch(this.onGenerationFail.bind(this));
  };

  private onGenerationFail(error: Error) {
    this.isDownloading = false;
    this.core.notifications.toasts.addDanger({
      title: `Excel download failed`,
      text:`We couldn't generate your Excel at this time.`,
      'data-test-subj': 'downloadExcelFail',
    });
  }
}
