var baseUrl = "https://rally1.rallydev.com/slm/webservice/v2.0/";
var baseViewUrl = "https://rally1.rallydev.com/#/40984977258d/detail/"; // Substitute your ID for your main project
var fetchAttrs = "FormattedID,Name,Project[ObjectID],State,ScheduleState,ObjectID,Children,Parent,Tasks";
var currentProject, showByDefault;
var queue, done;

function createRequest(url) {
	var request = new XMLHttpRequest();
	request.withCredentials = true;
	request.open("GET", url, true);
	return request;
}

function onArtifactReceived(artifact, parentRef) {
	var ref = artifact._ref;
	var parent = queue[parentRef];
	parent["children"].push(artifact);
	if (artifact.Children && artifact.Children.Count > 0) {
		queue[ref] = { "children": [] };
		getItem(artifact.Children._ref, ref);
	} else if (artifact.Tasks && artifact.Tasks.Count > 0) {
		queue[ref] = { "children": [] };
		getItem(artifact.Tasks._ref, ref);
	}
	if (parent["children"].length === parent["total"]) {
		done[parentRef] = parent;
		delete queue[parentRef];
		if (Object.keys(queue).length === 0) buildTree();
	}
}

function getItem(resRef, parentRef, start) {
	if (start === undefined) start = 1;
	var conj = (resRef.indexOf("?") === -1) ? "?" : "&";
	var url = resRef + conj + "shallowFetch=" + fetchAttrs + "&order=Rank&pagesize=100&start=" + start;
	var request = createRequest(url);
	request.onreadystatechange = function() {
		if (request.readyState === 4 && request.status === 200) {
			var json = JSON.parse(request.responseText);
			var items = json.QueryResult.Results;
			if (items.length > 0) {
				queue[parentRef]["total"] = json.QueryResult.TotalResultCount;
				if (queue[parentRef]["total"] > items.length) getItem(resRef, parentRef, start + 100);
				for (var i in items) {
					onArtifactReceived(items[i], parentRef);
				}
			}
		}
	};
	request.send();
}

function hideItem(cont, bShow, anchor, divider) {
	cont.style("display", "none");
	bShow.style("display", "");
	anchor.style("display", "none");
	divider.style("display", "none");
}
function showItem(cont, bShow, anchor, divider) {
	cont.style("display", "");
	bShow.style("display", "none");
	anchor.style("display", "");
	divider.style("display", "");
}

function buildTree() {
	d3.select("section").selectAll("*").remove();
	d3.select("nav").selectAll("*").remove();
	var children = done["top"]["children"];
	for (var j in children) {
		generate(children[j]);
	}
	d3.select("nav :last-child").remove();
	d3.select("button").attr("disabled", null).text("Fetch");
	queue = null, done = null;
}

function generate(root) {
	var margin = { top: 0, right: 50, bottom: 0, left: 50 },
		width = 2000 - margin.right - margin.left,
		nodeWidth = 300,
		nodeHeight = 30,
		radius = 8;
	var i = 0;
	var highestNode = 0, lowestNode = 0;

	var tree = d3.layout.tree().nodeSize([nodeHeight, nodeWidth]);
	tree.children(function(node) {
		return ((node.Children && node.Children.Count > 0)
				|| (node.Tasks && node.Tasks.Count > 0)) ? done[node._ref]["children"] : [];
	});

	var diagonal = d3.svg.diagonal().projection(function(node) { return [node.y, node.x]; });
		
	var nodes = tree.nodes(root);
	var links = tree.links(nodes);

	var showButton = d3.select("section").append("button")
		.text("Show " + root.FormattedID).style("display", "none");
	var container = d3.select("section").append("container")
		.attr("id", root.FormattedID);
	var anchor = d3.select("nav").append("a")
		.attr("href", "#" + container.attr("id"))
		.attr("title", root.Name)
		.text(root.FormattedID);
	var divider = d3.select("nav").append("span").text(" | ");
	var hideButton = container.append("button")
		.text("Hide " + root.FormattedID);
	if (!showByDefault) {
		hideItem(container, showButton, anchor, divider);
	}
		
	hideButton.on("click", function() {
		hideItem(container, showButton, anchor, divider);
	});
	showButton.on("click", function() {
		showItem(container, d3.select(this), anchor, divider);
	});

	nodes.forEach(function(node) {
		if (node.x < highestNode) highestNode = node.x;
		if (node.x > lowestNode) lowestNode = node.x;
	});

	var svg = container.append("svg:svg")
		.attr("height", (nodeHeight * 2) + Math.abs(highestNode) + lowestNode)
		.attr("width", width + margin.left + margin.right)
		.append("svg:g")
		.attr("transform", "translate(" + margin.left + "," + (nodeHeight - highestNode) + ")");

	var link = svg.selectAll("path.link")
		.data(links)
		.enter()
		.append("svg:path")
		.attr("class", "link")
		.attr("d", diagonal);

	var nodeGroup = svg.selectAll("g.node")
		.data(nodes)
		.enter()
		.append("svg:g")
		.attr("class", "node")
		.attr("transform", function(node) { return "translate(" + node.y + "," + node.x + ")"; });

	nodeGroup.append("svg:circle")
		.attr("r", radius)
		.style("fill", function(node) {
			if (node.Project.ObjectID === currentProject.ObjectID) {
				showItem(container, showButton, anchor, divider);
				return "#e88";
			}
			else return "#fff";
		});

	nodeGroup.append("text")
		.attr("dx", function(node) { return node.children ? (radius * -2) : (radius * 2); })
		.attr("dy", 3)
		.attr("text-anchor", function(node) { return node.children || "start"; })
		.text(function(node) { return node.FormattedID + ": " + node.Name })
		
	nodeGroup.append("svg:a")
		.attr("xlink:href", function(node) {
			var type = (node._type.toLowerCase() === "hierarchicalrequirement") ? "userstory" : node._type.toLowerCase();
			return baseViewUrl + type + "/" + node.ObjectID;
		})
		.attr("target", "_blank")
		.append("svg:rect")
		.attr("y", -radius)
		.attr("height", nodeHeight)
		.attr("width", nodeWidth)
		.style("fill-opacity", 0);

	container.append("a").attr("class", "toplink").attr("href", "#top").text("Back to top").append("br");
}

function dig() {
	var input = document.getElementById("itemid").value;
	showByDefault = document.getElementById("expandall").checked;
	var url = "";
	if (input) {
		var params = "query=(FormattedID = " + input + ")";
		var type = artifactTypes[input.replace(/[0-9]/g, "")];
		url = baseUrl + type + "?" + params;
		showByDefault = true;
	} else {
		var params = "query=(Parent = null)";
		url = baseUrl + "HierarchicalRequirement" + "?" + params;
	}
	d3.select("button").attr("disabled", true).text("Wait...");
	queue = {}, done = {};
	queue["top"] = { "children": [] };
	getItem(url, "top", 1);
}

Rally.onReady(function () {
	currentProject = Rally.environment.getContext().getProject();
	d3.select("button").attr("disabled", null);
});