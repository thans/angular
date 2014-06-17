Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {
            xtype: 'rallysolrartifactchooserdialog',
            id: 'portfolioItemPicker',
            artifactTypes: ['portfolioitem/initiative'],
            autoShow: true,
            height: 250,
            title: 'Choose an Initiative',
            listeners: {
                artifactChosen: function(picker, selectedRecord) {
                    App._getArtifacts(selectedRecord);
                },
                scope: this
            }
        },

    ],

    launch: function() {
        App = this;
        //App.down('#angularDiv').hide();

        module = angular.module('angularBlastdown', []);
    },

    /*
     * Get all artifacts that fall within the givin scope
     * and organize them into a logically grouped mapping
     */
    _getArtifacts: function(scope) {
        var hierarchy = scope.get('ObjectID');
        console.log("Querying lbAPI for artifacts under " + hierarchy);

        aggregateData = {
            initiative: scope.data,
            features: {},
            storiesAndDefects: {},
            parentless: []
        };

        var tasks = [];
        App.add({
            html: '<div ng-controller="dataController" id="root"><table><thead><tr><th colspan="2">Features of {{initiative.FormattedID}}</th></tr></thead><tbody><tr ng-repeat="feature in features"><td>{{$index + 1}}</td><td>{{feature.feature.Name}}</td></tr></tbody></table></div>',
            id: 'angularDiv',
            height: 500
        });
        Ext.getBody().mask('Loading');
        Ext.create('Rally.data.lookback.SnapshotStore', {
            listeners: {
                load: function(store, data, success) {
                    // Aggregate data
                    _.each(data, function(artifact) {
                        var types = artifact.raw._TypeHierarchy;
                        switch (types[types.length - 1]) {
                            case "Defect":
                                aggregateData.storiesAndDefects[artifact.data.ObjectID] = {
                                    artifact: artifact.raw,
                                    children: []
                                };
                                break;
                            case "HierarchicalRequirement":
                                aggregateData.storiesAndDefects[artifact.data.ObjectID] = {
                                    artifact: artifact.raw,
                                    children: []
                                };
                                break;
                            case "PortfolioItem/Feature":
                                aggregateData.features[artifact.data.ObjectID] = {
                                    feature: artifact.raw,
                                    children: []
                                };
                                break;
                            case "Task":
                                Ext.Array.push(tasks, artifact.raw);
                                break;
                            default: // ignore
                        }
                    });

                    var organizedData = App._organizeData(aggregateData, tasks);

                    // assign order values to the features and stories so they can align

                    /* TODO order data differently to inidicate age?
                    var features = _.toArray(organizedData.features);
                    console.log(features);

                    _.sortBy(features, function(artifact) {
                        return parseInt(artifact.feature.ObjectID);
                    });

                    for (var i = 0; i < features.length; i++) {
                        console.log('feature[i]', features[i]);
                        organizedData.features[features[i].feature.ObjectID].order = i + 1; // convert to 1 based for ordering
                    }
                    */
                    console.log(organizedData);
                    Ext.getBody().unmask();
                    App.down('#portfolioItemPicker').hide();

                    App._goAngular(organizedData);
                    // From here on out we want an angular/melon/js app
                }
            },
            fetch: true,
            hydrate: ["ScheduleState", "State", "_TypeHierarchy"],
            findConfig: {
                "_ItemHierarchy" : hierarchy,
                "__At" : "current"
            }
        }).load();
    },

    /*
     * Create a hierarchy of data
     * Map Tasks to their Story/Defect
     * Map Stories/Defects to a feature
     * Map the initiative to its features
     */
    _organizeData: function(aggregateData, tasks) {

        // organizedData
        //   |
        //   +-->Initiative
        //   +-->Features
        //       |
        //       +-->Stories/Defects
        //           |
        //           +-->Tasks
        var organizedData = {
            initiative: aggregateData.initiative
        };

        // Add tasks as children of their associated story/defect
        _.each(tasks, function(task) {
            var parent = task.WorkProduct;

            if (aggregateData.storiesAndDefects[parent]) {
                // add it to the list of children
                Ext.Array.push(aggregateData.storiesAndDefects[parent].children, task);
            } else {
                // not parented to a story/defect
                console.log('not parented to a story or defect', task);
            }
        });

        // Add stories and tasks as children of their feature
        _.each(aggregateData.storiesAndDefects, function(object, oid) {
            var parent;
            console.log(object);
            var types = object.artifact._TypeHierarchy;

            if (types[types.length - 1] === "HierarchicalRequirement") {
                // stories have an associated PortfolioItem/Feature
                parent = object.artifact.PortfolioItem;
            } else {
                // defects associate with a story or defect that will parent to a Feature
                var requirement = aggregateData.storiesAndDefects[object.artifact.Requirement];
                if (requirement) {
                    parent = requirement.artifact.PortfolioItem;
                } else {
                    console.log('not found', object);
                }
            }

            if (aggregateData.features[parent]) {
                // add it to the list of children
                Ext.Array.push(aggregateData.features[parent].children, object);
            } else {
                // not parented to a feature
                console.log('not parented to a feature');
            }
        });

        organizedData.features = aggregateData.features;
        return organizedData;
    },

    _goAngular: function(organizedData) {

        $('body').removeClass('x-body');
        $('html').removeClass('x-viewport');
        console.log(_.toArray(organizedData.features));
        module.controller('dataController', function($scope) {
            $scope.age = 1234;
            $scope.features = _.toArray(organizedData.features);
            $scope.initiative = organizedData.initiative;
        });

        angular.bootstrap(document.body, ['angularBlastdown']);
        var scope = angular.element(document.body).scope();

        scope.app = App.getContext().map.map;
        scope.$digest();
    }
});

/*

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: {
        html: '<div ng-controller="dataController" id="root"><h1>{{age}}</h1></div>'
    },
    launch: function() {
        App = this;
        $('#root').hide();

        module = angular.module('angularBlastdown', []);
    },

    listeners: {
        afterlayout: function(container) {

        }
    }

});

goAngular: function() {
    $('#root').show();

    $('body').removeClass('x-body');
    $('html').removeClass('x-viewport');
    module.controller('dataController', function($scope) {
        $scope.age = 1234;
    });

    angular.bootstrap(document.body, ['angularBlastdown']);
    var scope = angular.element(document.body).scope();

    scope.app = App.getContext().map.map;
    scope.$digest();
}*/
