sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("com.invoiceappairdit.invoiceapprovalairdit.controller.Invoicepdf", {
        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            this.getView().setModel(new JSONModel({ showPdf: false, showLogs: false }), "viewModel");
            this.getView().setModel(new JSONModel([]), "logsModel");
            oRouter.getRoute("Invoicepdf").attachPatternMatched(this._onRouteMatched, this);
            oRouter.getRoute("InvoiceLogs").attachPatternMatched(this._onLogsMatched, this);

        },

        _onRouteMatched: function (oEvent) {
            const imageUrl = decodeURIComponent(oEvent.getParameter("arguments").imageUrl);
            this.getView().getModel("viewModel").setProperty("/showPdf", true);
            this.getView().getModel("viewModel").setProperty("/showLogs", false);
            if (imageUrl) {
                setTimeout(() => {
                    const iframe = document.getElementById("pdfFrame");
                    if (iframe) {
                        iframe.src = imageUrl;
                    }
                }, 0);
            } else {
                sap.m.MessageToast.show("PDF URL not provided.");
            }
        },

        _onLogsMatched: function (oEvent) {
            debugger;
            const requestNo = oEvent.getParameter("arguments").requestNo;
            this.getView().getModel("viewModel").setProperty("/showPdf", false);
            this.getView().getModel("viewModel").setProperty("/showLogs", true);
            const oModel = this.getOwnerComponent().getModel();
            const aFilters = [
                new Filter("REQUEST_NO", FilterOperator.EQ, requestNo) //SES_VIM_APPROVAL_LOGS?$filter=REQUEST_NO%20eq%201000000622
            ];

            oModel.read("/VIM_APPROVAL_LOGS", {
                filters: aFilters,
                success: function (oData) {
                    const logs = oData.results || [];
                    this.getView().getModel("logsModel").setData(logs);

                    if (logs.length === 0) {
                        sap.m.MessageToast.show("No logs present");
                    }
                }.bind(this),
                error: function () {
                    sap.m.MessageToast.show("Failed to load logs.");
                }
            });
        },

        onClosePreview: function () {
            history.go(-1);
        }
    });
});
