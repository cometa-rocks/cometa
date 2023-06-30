import { Injectable } from '@angular/core';
import { MatLegacyPaginatorIntl as MatPaginatorIntl } from '@angular/material/legacy-paginator';
import { TranslateParser, TranslateService } from '@ngx-translate/core';

/**
 * Custom MatPaginator class with multi-language support
 */
@Injectable()
export class i18nMatPaginatorIntl extends MatPaginatorIntl {

    private rangeLabelIntl: string;

    constructor(
        private translateService: TranslateService,
        private translateParser: TranslateParser
    ) {
        super();
        this.getTranslations();
    }

    getTranslations() {
        this.translateService.stream([
            'paginator.items',
            'paginator.next',
            'paginator.previous',
            'paginator.first',
            'paginator.last',
            'paginator.range'
        ])
        .subscribe(translation => {
            this.itemsPerPageLabel = translation['paginator.items'];
            this.nextPageLabel = translation['paginator.next'];
            this.firstPageLabel = translation['paginator.first'];
            this.lastPageLabel = translation['paginator.last'];
            this.previousPageLabel = translation['paginator.previous'];
            this.rangeLabelIntl = translation['paginator.range'];
            this.changes.next();
        });
    }

    getRangeLabel = (page, pageSize, length) => {
        length = Math.max(length, 0);
        let startIndex = page * pageSize;
        const endIndex = startIndex < length ?
        Math.min(startIndex + pageSize, length) :
        startIndex + pageSize;
        startIndex++;
        return this.translateParser.interpolate(this.rangeLabelIntl, { startIndex, endIndex, length });
    };

}