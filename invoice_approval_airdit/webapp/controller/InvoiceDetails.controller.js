sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], (Controller, JSONModel, Filter, FilterOperator, MessageBox, Fragment) => {
    "use strict";

    return Controller.extend("com.invoiceappairdit.invoiceapprovalairdit.controller.InvoiceDetails", {
        onInit() {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("InvoiceDetails").attachPatternMatched(this._onObjectMatched, this);
            let oModel = this.getOwnerComponent().getModel();
            this.getView().setModel(oModel)
        },

        _onObjectMatched: function (oEvent) {
            debugger;
            let poNum = oEvent.getParameter("arguments").id; // Purchase Order Number (Ebeln)
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "OneColumn");
            let oFilters = [
                new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, poNum)
            ];

            let oModel = this.getView().getModel();

            oModel.read("/VIMDATA", {
                filters: oFilters,
                success: function (res) {
                    debugger;
                    let headData = res.results[0] || {};
                    let currentTab = headData.Status;
                    let oHeadModel = new sap.ui.model.json.JSONModel(headData);
                    this.getView().setModel(oHeadModel, "headData");

                    // Items Data
                    let items = (headData.TO_VIM_ITEMS && headData.TO_VIM_ITEMS.results) || [];
                    let oItemsModel = new sap.ui.model.json.JSONModel({ results: items });
                    this.getView().setModel(oItemsModel, "tableModel");

                    // Attachments Data
                    let attachments = (headData.TO_VIM_ATTACHMENTS && headData.TO_VIM_ATTACHMENTS.results) || [];
                    let filteredAttachments;
                    if (currentTab !== 'REJECTED') {
                        filteredAttachments = attachments.filter(a => a.STATUS === "Pending");
                    } else {
                        filteredAttachments = attachments;
                    }


                    let oAttachmentModel = new sap.ui.model.json.JSONModel({ attachments: filteredAttachments });
                    this.getView().setModel(oAttachmentModel, "attachmentsModel");
                }.bind(this),  // <== Important: bind `this` so `this.getView()` works

                error: function (err) {
                    debugger;
                    sap.m.MessageToast.show("Failed to load PO data.");
                }
            });
        },

        onPreviewPdf: function (oEvent) {
            const imageUrl = oEvent.getSource().data("imageUrl");
            if (!imageUrl) {
                sap.m.MessageToast.show("No file URL available.");
                return;
            }

            const encodedUrl = encodeURIComponent(imageUrl);
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "TwoColumnsBeginExpanded");
            this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                imageUrl: encodedUrl
            });
        },


        onInvoiceApprove: function () {
            if (!this._pApproveCommentDialog) {
                this._pApproveCommentDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.invoiceappairdit.invoiceapprovalairdit.fragments.ApproveComment",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this._pApproveCommentDialog.then(function (oDialog) {
                this.byId("approveCommentTextArea").setValue("");
                this.byId("approveCharCounter").setText("0 / 500");
                oDialog.open();
            }.bind(this));
        },

        onApproveCommentLiveChange: function (oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            this.byId("approveCharCounter").setText(`${sValue.length} / 500`);
        },

        onApproveCommentCancel: function () {
            this.byId("approveCommentDialog").close();
        },

        onApproveCommentSubmit: function () {
            const sComment = this.byId("approveCommentTextArea").getValue();

            if (!sComment?.trim()) {
                MessageBox.warning("Approval comment is required.");
                return;
            }

            this.byId("approveCommentDialog").close();
            this._finalizeInvoiceApproval(sComment);
        },

        _finalizeInvoiceApproval: function (sComment) {
            const oView = this.getView();
            const oHeadData = oView.getModel("headData").getData();
            const oItemModel = oView.getModel("tableModel").getData();
            const aItems = oItemModel?.results || [];
            const oAttachmentsModel = oView.getModel("attachmentsModel").getData();
            const aAttachments = oAttachmentsModel?.attachments || [];

            // Add comment
            oHeadData.APPROVED_COMMENT = sComment;

            const payload = {
                action: "APPROVE",
                REQUEST_NO: oHeadData.REQUEST_NO,
                Vimhead: [oHeadData],
                Vimitem: aItems,
                Attachment: aAttachments
            };

            const oModel = oView.getModel(); // OData model
            oView.setBusy(true);

            oModel.create("/PostVimData", payload, {
                success: function () {
                    oView.setBusy(false);
                    MessageBox.success("Invoice approved successfully!", {
                        title: "Success",
                        onClose: () => {
                            this.getOwnerComponent().getRouter().navTo("RoutePOLists");
                        }
                    });
                }.bind(this),
                error: function (oError) {
                    oView.setBusy(false);
                    MessageBox.error("Approval failed. Please try again.", { title: "Error" });
                    console.error("Approval Error:", oError);
                }
            });
        },



        onInvoiceReject: function () {
            if (!this._oRejectDialog) {
                this._oRejectDialog = sap.ui.xmlfragment(
                    "com.invoiceappairdit.invoiceapprovalairdit.fragments.RejectionDialog",
                    this
                );
                this.getView().addDependent(this._oRejectDialog);
            }
            this._oRejectDialog.open();
        },

        onConfirmReject: function () {
            const oView = this.getView();
            const oHeadData = oView.getModel("headData").getData();
            const aItems = oView.getModel("tableModel").getData();
            const aAttachments = oView.getModel("attachmentsModel").getData() || [];
            const sComment = sap.ui.getCore().byId("rejectionComment").getValue().trim();

            if (!sComment) {
                sap.m.MessageBox.warning("Please enter a rejection comment.");
                return;
            }

            oView.setBusy(true); // ✅ Start busy indicator

            const payload = {
                action: "REJECT",
                REQUEST_NO: oHeadData.REQUEST_NO,
                Vimhead: [
                    {
                        ...oHeadData,
                        REJECTED_COMMENT: sComment,
                        Status: "REJECTED"
                    }
                ],
                Vimitem: aItems?.results || [],
                Attachment: aAttachments.attachments

            };

            const oModel = oView.getModel();
            oModel.create("/PostVimData", payload, {
                success: function () {
                    oView.setBusy(false); // ✅ Stop busy indicator
                    if (this._oRejectDialog) {
                        this._oRejectDialog.close();
                    }
                    MessageBox.success("Invoice rejected successfully!", {
                        title: "Success",
                        onClose: function () {
                            this.getOwnerComponent().getRouter().navTo("RoutePOLists");
                        }.bind(this)
                    });
                }.bind(this),
                error: function (oError) {
                    oView.setBusy(false); // ❌ Stop busy on error too
                    if (this._oRejectDialog) {
                        this._oRejectDialog.close();
                    }
                    MessageBox.error("Rejection failed. Please try again.");
                    console.error("Rejection Error:", oError);
                }.bind(this)
            });
        },


        onRejectDialogClose: function () {
            this._oRejectDialog.close();
            sap.ui.getCore().byId("rejectionComment").setValue(""); // clear input
        },



        handleClose: function () {
            this.getOwnerComponent().getRouter().navTo("RoutePOLists")

        },

        isPending: function (sStatus) {
            return sStatus !== "APPROVED" && sStatus !== "REJECTED";
        }



    });
});