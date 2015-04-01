// The MIT License (MIT)
//
// Copyright (c) 2013 David Evans
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// ## Actions
(function(TANK)
{
  TANK.Action = TANK.Action || {};

  TANK.Action.State =
  {
    uninitialized: 0,
    queued: 1,
    active: 2,
    complete: 3,
    cancelled: 4
  };

  TANK.Action.mixin = function(action)
  {
    action._state = TANK.Action.State.uninitialized;

    // Add cancel API
    if (!action.cancel)
    {
      action.cancel = function()
      {
        this._state = TANK.Action.State.cancelled;
      };
    }

    // Add done API
    if (!action.done)
    {
      action.done = function()
      {
        this._state = TANK.Action.State.complete;
      };
    }

    return action;
  };

  //
  // ## Action Group
  //
  TANK.Action.Group = function()
  {
    this._actions = [];
  };

  TANK.Action.Group.prototype.add = function(action)
  {
    TANK.Action.mixin(action);

    this._actions.push(action);
    action._state = TANK.Action.State.queued;

    if (this._state === TANK.Action.State.complete || this._state === TANK.Action.State.cancelled)
      this._state = TANK.Action.State.active;
  };

  TANK.Action.Group.prototype.update = function(entity, dt)
  {
    // Update all actions
    var action;
    var allDone = true;
    for (var i = 0; i < this._actions.length; ++i)
    {
      action = this._actions[i];

      // Call start on first run
      if (action._state === TANK.Action.State.queued)
      {
        action.start && action.start(entity);
        action._state = TANK.Action.State.active;
      }

      // Call update while active
      if (action._state === TANK.Action.State.active)
      {
        action.update && action.update(entity, dt);

        // Call end when completed
        if (action._state !== TANK.Action.State.active)
          action.end && action.end(entity);
        else
          allDone = false;
      }
    }

    // Remove finished actions
    this._actions = this._actions.filter(function(val)
    {
      return val._state === TANK.Action.State.queued || val._state === TANK.Action.State.active;
    });

    // Done when all children are done
    if (allDone)
      this._state = TANK.Action.State.complete;
  };

  TANK.Action.Group.prototype.cancel = function()
  {
    for (var i = 0; i < this._actions.length; ++i)
      this._actions[i].cancel();
    this._state = TANK.Action.State.cancelled;
  };

  //
  // ## Action Sequence
  //
  TANK.Action.Sequence = function()
  {
    this._actions = [];
  };

  TANK.Action.Sequence.prototype.add = function(action)
  {
    TANK.Action.mixin(action);

    this._actions.push(action);
    action._state = TANK.Action.State.queued;

    if (this._state === TANK.Action.State.complete || this._state === TANK.Action.State.cancelled)
      this._state = TANK.Action.State.active;
  };

  TANK.Action.Sequence.prototype.update = function(entity, dt)
  {
    // Update first action
    var action = this._actions[0];

    if (action)
    {
      // Call start on first run
      if (action._state === TANK.Action.State.queued)
      {
        action.start && action.start(entity);
        action._state = TANK.Action.State.active;
      }

      // Call update while active
      if (action._state === TANK.Action.State.active)
      {
        action.update && action.update(entity, dt);

        // Call end when completed
        if (action._state !== TANK.Action.State.active)
          action.end && action.end(entity);
      }

      // Remove finished actions
      if (action._state === TANK.Action.State.complete || action._state === TANK.Action.State.cancelled)
        this._actions.splice(0, 1);
    }

    // Done when all children are done
    if (!this._actions.length)
      this._state = TANK.Action.State.complete;
  };

  TANK.Action.Sequence.prototype.cancel = function()
  {
    for (var i = 0; i < this._actions.length; ++i)
      this._actions[i].cancel();
    this._state = TANK.Action.State.cancelled;
  };

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
// The MIT License (MIT)
//
// Copyright (c) 2013 David Evans
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// ## Component
// A `Component` represents a small piece of funtionality of
// an `Entity`.
(function(TANK)
{
  "use strict";

  // ## Constructor
  // Construct a new `Component` instance based on a `ComponentDef`. This calls
  // the `construct` method defined by the `ComponentDef`.
  //
  // `TANK.ComponentDef componentDef` - The component definition object to use.
  TANK.Component = function(componentDef)
  {
    this._name = componentDef._name;
    this._construct = componentDef._construct;
    this._serialize = componentDef._serialize;
    this._initialize = componentDef._initialize;
    this._uninitialize = componentDef._uninitialize;
    this._entity = null;
    this._constructed = false;
    this._initialized = false;
    this._listeners = [];
    this._construct();
    this._constructed = true;

    Object.defineProperty(this, 'name', { get: function() {return this._name;} });
    Object.defineProperty(this, 'entity', { get: function() {return this._entity;} });
  };

  // ## Listen to an event
  // Register a function to be called when a particular event
  // is disaptched by the given entity.
  //
  // `entity` - The entity to listen for events from. In many cases
  // this will be the `TANK.main` entity.
  //
  // `eventName` - The string name of the event to listen for. All events
  // are case insensitive.
  //
  // `func` - The function to act as the callback for the event. In the callback
  // `this` is set to point at the component instance.
  TANK.Component.prototype.listenTo = function(entity, eventName, func)
  {
    eventName = eventName.toLowerCase();
    var evt = {self: this, eventName: eventName, func: func, entity: entity};

    var entityListeners = entity._events[eventName] || [];
    entity._events[eventName] = entityListeners;

    entityListeners.push(evt);
    this._listeners.push(evt);

    return this;
  };

  // ## Stop listening to an event
  // Stop listening to an entity for a particular event.
  // Note that events are automatically removed when a component
  // is uninitialized.
  //
  // `entity` - The entity to stop listening to.
  //
  // `eventName` - The name of the event to stop listening to.
  TANK.Component.prototype.stopListeningTo = function(entity, eventName)
  {
    eventName = eventName.toLowerCase();
    var entityListeners = entity._events[eventName];
    if (!entityListeners)
    {
      console.warn("A component tried to stop listening to an event it was not listening to");
      return this;
    }

    // Remove local listener
    for (var i = 0; i < this._listeners.length; ++i)
    {
      var evt = this._listeners[i];
      if (evt.eventName === eventName && evt.entity === entity)
      {
        this._listeners.splice(i, 1);
        break;
      }
    }

    // Remove listener on entity
    for (i = 0; i < entityListeners.length; ++i)
    {
      var entityEvt = entityListeners[i];
      if (entityEvt.self === this)
      {
        entityListeners.splice(i, 1);
        break;
      }
    }
  };

  // ## Initialize
  // Initializes the component, and calls the `initialize` method
  // defined by the `ComponentDef`.
  TANK.Component.prototype.initialize = function()
  {
    // Track all components on the entity
    if (this._entity && this._entity._parent)
    {
      if (!this._entity._parent._childComponents[this._name])
        this._entity._parent._childComponents[this._name] = {};
      var objectsWithComponent = this._entity._parent._childComponents[this._name];
      objectsWithComponent[this._entity._id] = this._entity;
    }

    this._initialize();
    this._initialized = true;
  };

  // ## Serialize
  // Serializes the component by calling the `serialize` method defined by the
  // `ComponentDef`.
  TANK.Component.prototype.serialize = function(serializer)
  {
    this._serialize(serializer);
  };

  // ## Uninitialize
  // Uninitializes the component, and calls the `uninitialize` method
  // defined by the `ComponentDef`. This removes all listeners previous added.
  TANK.Component.prototype.uninitialize = function()
  {
    // Remove component from tracking
    if (this._entity && this._entity._parent)
    {
      var objectsWithComponent = this._entity._parent._childComponents[this._name];
      delete objectsWithComponent[this._entity._id];
    }

    // Remove all listeners
    for (var i = 0; i < this._listeners.length; ++i)
    {
      var evt = this._listeners[i];
      var entityListeners = evt.entity._events[evt.eventName];
      if (!entityListeners)
        continue;

      for (var j = 0; j < entityListeners.length; ++j)
      {
        var entityEvt = entityListeners[j];
        if (entityEvt.self === this)
        {
          entityListeners.splice(j, 1);
          j = entityListeners.length;
        }
      }
    }

    this._listeners = [];
    this._uninitialize();
    this._initialized = false;
  };

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
// The MIT License (MIT)
//
// Copyright (c) 2013 David Evans
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// ## Component Definition
// A component definition defines the functionality of a type
// of component.
(function(TANK)
{
  "use strict";

  // ## Constructor
  // Construct a new component definition object.
  //
  // `string name` - The name of the component definition, e.g., "Pos2D".
  TANK.ComponentDef = function(name)
  {
    // Component name must be a valid identifier
    if ((name[0] >= 0 && name[0] <= 9) || name.search(" ") >= 0)
    {
      TANK.error(name + " is an invalid identifier and won't be accessible without [] operator");
    }

    this._name = name;
    this._includes = [];
    this._construct = function() {};
    this._serialize = function() {};
    this._initialize = function() {};
    this._uninitialize = function() {};
  };

  // ## Include other Components
  // Use this to mark other components that will automatically
  // be added to an Entity that this component is added to.
  // For example a Sprite component would probably include a
  // transform / position component. This method is designed to be
  // chained off of a call to `TANK.registerComponent`
  //
  // `componentNames` - Either an Array of Component names or a single
  // string Component name.
  TANK.ComponentDef.prototype.includes = function(componentNames)
  {
    if (!Array.isArray(componentNames))
      componentNames = [componentNames];

    // Copy the array
    this._includes = componentNames.slice();

    return this;
  };

  // ## Define a constructor
  // Define a function that will be called when an instance of
  // the component type is created, such as when it is added to an
  // Entity. This is usually where fields on the component are given
  // default values. This method is designed to be chained off of a call to
  // `TANK.registerComponent`.
  //
  // `func` - A function that will be used to construct the component.
  // The function is invoked with `this` pointing at the component
  // instance.
  TANK.ComponentDef.prototype.construct = function(func)
  {
    this._construct = func;
    return this;
  };

  // ## Define a serialize method
  // Define a function that will be called when the component is
  // serialized (either a read or a write).
  //
  // `func` - A function that will be used to construct the component.
  // The function is invoked with `this` pointing at the component
  // instance. The function takes as a parameter a `Serializer`.
  TANK.ComponentDef.prototype.serialize = function(func)
  {
    this._serialize = func;
    return this;
  };

  // ## Define an initialize function
  // Define a function that will be called when the entity this component
  // is a part of is initialized. Initialize is usually where custom methods are
  // defined and is where event listeners should be added. This method is designed
  // to be chained off of a call to `TANK.registerComponent`.
  //
  // `func` - A function that will be used to initialize the component.
  // The function is invoked with `this` pointing at the component
  // instance.
  TANK.ComponentDef.prototype.initialize = function(func)
  {
    this._initialize = func;
    return this;
  };

  // ## Define an initialize function
  // Define a function that will be called when the entity this component
  // is a part of is initialized. This is where anything done in `initialize`
  // can be undone, if necessary. Note that listeners are already automatically
  // removed when a component is uninitialized. This method is designed to be
  // chained off of a call to `TANK.registerComponent`
  //
  // `func` - A function that will be used to initialize the component.
  // The function is invoked with `this` pointing at the component
  // instance.
  TANK.ComponentDef.prototype.uninitialize = function(func)
  {
    this._uninitialize = func;
    return this;
  };

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
// The MIT License (MIT)
//
// Copyright (c) 2013 David Evans
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// ## TANK
// The main namespace from which all the features of the engine
// are accessed.
(function(TANK)
{
  "use strict";

  // ## Create the engine
  // Creates the main engine Entity that receives the
  // animation frame callback when `TANK.start()` is called.
  // In a simple project, systems would be attached to this entity,
  // and game objects added as direct children of it. The parameter is
  // passed directly to the constructor of Entity.
  //
  // `componentNames` - Either an Array of Component names or a single
  // string Component name.
  TANK.createEngine = function(componentNames)
  {
    TANK.main = TANK.createEntity(componentNames);
    return TANK;
  };

  // ## Start game loop
  // Begins the main game loop using `requestAnimationFrame`.
  // This also initializes the main engine entity.
  TANK.start = function()
  {
    TANK.main.initialize();
    TANK.main.dispatch("start");
    _running = true;
    update();
    return TANK;
  };

  // ## Stop game loop
  // Sets a flag to not request another animation frame at
  // the end of the next update loop. Note that this is different
  // than pausing an individual entity, as it actually stops the
  // request animation frame loop, whereas pausing simply skips the
  // relevant entity's update call.
  TANK.stop = function()
  {
    _running = false;
  };

  // ## Register a component definition
  // This is the entry point to defining a new type of component.
  // This method should be used over manually instantiating a `ComponentDef`
  // as it performs additional logic to store the definition.
  // The new `ComponentDef` is returned, to enable a return value chained style of defining
  // components.
  //
  // `string componentName` - A string containing a valid identifier to be used as the name of the
  // new Component type.
  //
  // `return` - A new `ComponentDef`.
  TANK.registerComponent = function(componentName)
  {
    var c = new TANK.ComponentDef(componentName);
    TANK._registeredComponents[componentName] = c;
    return c;
  };

  // ## Create an entity
  // Constructs a new `Entity` and adds the given components
  // to it.
  //
  // `[Array<string>, string] componentNames` - Either an Array of Component names or a single
  // string Component name.
  TANK.createEntity = function(componentNames)
  {
    var e = new TANK.Entity(componentNames);
    e._id = _nextId++;
    return e;
  };

  // ## Internal update loop
  function update()
  {
    // Get dt
    var newTime = new Date();
    var dt = (newTime - _lastTime) / 1000.0;
    _lastTime = newTime;
    if (dt > 0.05)
      dt = 0.05;

    // Update main entity
    TANK.main.update(dt);

    // Request next frame
    if (_running)
    {
      // Use RAF in browser
      if (typeof window == "undefined")
        setTimeout(update, 16);
      else
        window.requestAnimationFrame(update);
    }
  }

  var _nextId = 0;
  var _lastTime = 0;
  var _running = false;
  TANK._registeredComponents = {};

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);

// The MIT License (MIT)
//
// Copyright (c) 2013 David Evans
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// ## Entity
// An Entity represents a single game object or container. It contains Components
// and children Entities, and can also dispatch events. An Entity's functionality
// is defined by the set of Components it has, and can be used to represent the player,
// an object spawner, a trigger zone, or really just about anything. Since Entities can
// contain child Entities, they can be used to create hierachical structures, or to separate
// portions of your game that have separate behavior, since different Entities can send separate
// events and be paused individually.
(function(TANK)
{
  'use strict';

  // ## Entity Constructor
  // Construct a new Entity object. Takes a Component name
  // or array of Component names to add to the Entity.
  //
  // `[Array<string>, string] componentNames` - Either an Array of Component names or a single
  // string Component name.
  TANK.Entity = function(componentNames)
  {
    this._name = null;
    this._id = -1;
    this._parent = null;
    this._components = {};
    this._componentsOrdered = [];
    this._children = {};
    this._namedChildren = {};
    this._childComponents = {};
    this._pendingRemove = [];
    this._initialized = false;
    this._events = {};
    this._pendingEvents = [];
    this._paused = false;
    this._deleted = false;

    this._actions = new TANK.Action.Group();
    TANK.Action.mixin(this._actions);

    Object.defineProperty(this, 'name', { get: function() { return this._name; } });
    Object.defineProperty(this, 'id', { get: function() { return this._id; } });
    Object.defineProperty(this, 'parent', { get: function() { return this._parent; } });
    Object.defineProperty(this, 'actions', { get: function() { return this._actions; } });

    if (componentNames)
      this.addComponent(componentNames);
  };

  // ## Add Component
  // Add a Component to the Entity. This will initialize the Component
  // if the Entity is already initialized, otherwise it will only
  // construct the Component. It will also add Components included by
  // the Component first.
  //
  // `componentNames` - Either an Array of Component names or a single
  // string Component name.
  TANK.Entity.prototype.addComponent = function(componentNames)
  {
    if (!Array.isArray(componentNames))
      componentNames = [componentNames];

    for (var i = 0; i < componentNames.length; ++i)
    {
      // Skip this component if we already have it
      var componentName = componentNames[i];
      if (this._components[componentName])
        continue;

      // Get component definition
      var componentDef = TANK._registeredComponents[componentName];
      if (!componentDef)
      {
        console.error('No Component is registered with name: ' + componentName + '. Did you include it?');
        continue;
      }

      // Add placeholder component to prevent duplicate adds while parsing
      // dependencies
      this._components[componentName] = 'Placeholder';
      this[componentName] = 'Placeholder';

      // Add component dependencies
      for (var j = 0; j < componentDef._includes.length; ++j)
      {
        this.addComponent(componentDef._includes[j]);
      }

      // Clone the component
      var c = new TANK.Component(componentDef);
      this._components[componentName] = c;
      this[componentName] = c;
      this._componentsOrdered.push(c);
      c._entity = this;

      // Initialize the component immediately if the entity is already initialized
      if (this._initialized)
      {
        if (this._parent)
        {
          if (!this._parent._childComponents[componentName])
            this._parent._childComponents[componentName] = {};
          var objectsWithComponent = this._parent._childComponents[componentName];
          objectsWithComponent[this._id] = c;
        }
        c.initialize();
        var space = this._parent || this;
        space.dispatch(TANK.Event.componentAdded, c);
      }
    }

    return this;
  };

  // ## Remove Component
  // Remove a Component from the Entity. This will uninitialize the Component.
  //
  // `componentNames` - Either an Array of Component names or a single
  // string Component name.
  TANK.Entity.prototype.removeComponent = function(componentNames)
  {
    if (!Array.isArray(componentNames))
      componentNames = [componentNames];

    for (var i = 0; i < componentNames.length; ++i)
    {
      // Skip this component if we don't have it
      var componentName = componentNames[i];
      var c = this._components[componentName];
      if (!c)
        continue;

      // Send out remove event
      var space = this._parent || this;
      space.dispatch(TANK.Event.componentRemoved, c);

      // Uninitialize the component
      c.uninitialize();

      // Remove from map
      delete this[componentName];
      delete this._components[componentName];
      for (var j = 0; j < this._componentsOrdered.length; ++j)
      {
        if (this._componentsOrdered[j] === c)
        {
          this._componentsOrdered.splice(j, 1);
          break;
        }
      }

    }

    return this;
  };

  // ## Initialize
  // Initialize the Entity. This will call initialize on each
  // Component and child currently added to the Entity, in the order in which
  // they were added. Note that adding an Entity as a child to another
  // initialized Entity will call initialize already, so usually it is not
  // necessary to call this method manually.
  TANK.Entity.prototype.initialize = function()
  {
    // Initialize every component
    var i;
    for (i = 0; i < this._componentsOrdered.length; ++i)
    {
      var c = this._componentsOrdered[i];
      c.initialize();
      var space = this._parent || this;
      space.dispatch(TANK.Event.componentAdded, c);
    }

    // Initialize children
    for (i in this._children)
      this._children[i].initialize();

    this._initialized = true;

    return this;
  };

  // ## Uninitialize
  // Uninitializes every component and child within
  // the Entity.
  TANK.Entity.prototype.uninitialize = function()
  {
    // Uninitialize every component
    var i;
    for (i = this._componentsOrdered.length - 1; i >= 0; --i)
    {
      var c = this._componentsOrdered[i];
      var space = this._parent || this;
      space.dispatch(TANK.Event.componentRemoved, c);
      c.uninitialize();
    }

    // Uninitialize children
    for (i in this._children)
      this._children[i].uninitialize();

    this._initialized = false;

    return this;
  };

  // ## Write the entity to a JSON object
  // Builds a JSON representation of the entity by calling
  // serialize on every component
  TANK.Entity.prototype.save = function()
  {
    // Save some information about the entity itself
    var json = {};
    json.name = this._name;

    // Save each component
    json.components = {};
    for (var i = 0; i < this._componentsOrdered.length; ++i)
    {
      var c = this._componentsOrdered[i];
      var writer = new TANK.WriteSerializer();
      c.serialize(writer);

      json.components[c._name] = writer._writeObj;
    }

    // Save each child
    json.children = [];
    for (var i in this._children)
    {
      var child = this._children[i];
      json.children.push(child.save());
    }

    return json;
  };

  // ## Read a JSON object into an entity
  // Builds the entity from a JSON object by calling
  // serialize on each component.
  TANK.Entity.prototype.load = function(json)
  {
    // Read some information about the entity itself
    json = JSON.parse(JSON.stringify(json));
    json.components = json.components || {};
    json.children = json.children || {};
    this._name = json.name;

    // Load each component
    for (var i in json.components)
    {
      this.addComponent(i);
      var c = this._components[i];
      var reader = new TANK.ReadSerializer(json.components[i]);
      if (typeof c.serialize === 'function')
        c.serialize(reader);
    }

    // Load each child
    for (var i = 0; i < json.children.length; ++i)
    {
      var childObj = json.children[i];
      var e = TANK.createEntity();
      e.load(childObj);
      this.addChild(e);
    }
  };

  // ## Pause the entity
  TANK.Entity.prototype.pause = function()
  {
    this._paused = true;
  };

  // ## Unpause the entity
  TANK.Entity.prototype.unpause = function()
  {
    this._paused = false;
  };

  // ## Update
  // Runs the update loop on the Entity one time, with the specified
  // dt. This will call update on every Component and child Entity.
  // Calling this method manually could be useful for stepping the update
  // loop once frame at a time.
  //
  // `dt` - The elapsed time, in seconds
  TANK.Entity.prototype.update = function(dt)
  {
    if (this._paused)
      return;

    var i;
    // Remove deleted children
    for (i = 0; i < this._pendingRemove.length; ++i)
    {
      var id = this._pendingRemove[i]._id;
      var child = this._children[id];
      this.dispatch(TANK.Event.childRemoved, child);
      child.uninitialize();
      child._parent = null;
      delete this._children[id];
      delete this._namedChildren[child._name];
    }
    this._pendingRemove = [];

    // Dispatch pending events
    for (i = 0; i < this._pendingEvents.length; ++i)
    {
      // Dispatch the event if it's timer has reached 0
      var pendingEvent = this._pendingEvents[i];
      if (pendingEvent.time <= 0)
      {
        this.dispatch.apply(this, pendingEvent.args);
        this._pendingEvents.splice(i, 1);
        --i;
      }
      else
        pendingEvent.time -= dt;
    }

    // Update actions
    this._actions.update(this, dt);

    // Update every component
    for (i = 0; i < this._componentsOrdered.length; ++i)
    {
      if (this._componentsOrdered[i].update)
        this._componentsOrdered[i].update(dt);
    }

    // Update children
    for (i in this._children)
    {
      this._children[i].update(dt);
    }

    return this;
  };

  // ## Get all children with a Component
  // Get every child Entity with a given component. Runs in O(1) time
  // as this information is collected as children are added and removed.
  //
  // `componentName` - Name of the component to match Entities with
  //
  // `return` - An object with Entity IDs mapped to Entities
  TANK.Entity.prototype.getChildrenWithComponent = function(componentName)
  {
    return this._childComponents[componentName];
  };

  // ## Get the first parent with the specified component
  // Walks up the entity hierarchy until an entity with the given
  // component is found. This runs in O(n) time where n is the number
  // of parents the entity has.
  TANK.Entity.prototype.getFirstParentWithComponent = function(componentName)
  {
    var e = this;
    while (e && !e[componentName])
      e = e._parent;
    return e;
  };

  // ## Get a child Entity
  // Gets a child Entity with the given name or ID.
  //
  // `nameOrId` - Either the name of the Entity to get, or the ID.
  //
  // `return` - The Entity with the given name or ID, or undefined.
  TANK.Entity.prototype.getChild = function(nameOrId)
  {
    if (nameOrId.substr)
      return this._namedChildren[nameOrId];
    else if (!isNaN(nameOrId))
      return this._children[nameOrId];
  };

  // ## Add a child Entity
  // Add an Entity as a child to this one. The child will be initialized
  // if this Entity is already initialized.
  //
  // `childEntity` - The Entity to add as a child of this one
  //
  // `name` - [Optional] A name to give the added child
  TANK.Entity.prototype.addChild = function(childEntity, name)
  {
    // Check if entity is already a child of us
    if (childEntity._parent === this)
    {
      console.error('An Entity cannot have duplicate children');
      return this;
    }

    // The parent of a child must be initialized
    if (!this._initialized && childEntity._initialized)
    {
      console.error('An initialized Entity cannot have an uninitialized parent');
      return this;
    }

    // It is invalid to add a child that already has a parent
    if (childEntity._parent)
    {
      console.error('An Entity cannot be given multiple parents');
      return this;
    }

    // Set name if provided
    if (name)
      childEntity._name = name;

    // Add entity as a child
    this._children[childEntity._id] = childEntity;
    if (childEntity._name)
      this._namedChildren[childEntity._name] = childEntity;
    childEntity._parent = this;
    childEntity._deleted = false;

    // Initialize the child if we are initialized
    if (this._initialized)
      childEntity.initialize();

    this.dispatch(TANK.Event.childAdded, childEntity);

    return this;
  };

  // ## Remove a child Entity
  // Remove a child form the Entity. The removal of the child
  // will be deferred to the next frame, at which point the child
  // will be uninitialized.
  //
  // `childEntity` - The child to remove.
  TANK.Entity.prototype.removeChild = function(childEntity)
  {
    // Check if entity is a child
    if (this._children[childEntity._id])
    {
      // Error on double delete
      if (childEntity._deleted)
      {
        console.error('An Entity was deleted twice');
      }
      this._pendingRemove.push(childEntity);
      childEntity._deleted = true;
    }
    // Error otherwise
    else
    {
      console.error('The Entity being removed is not a child of the calling Entity');
      return this;
    }

    return this;
  };

  // ## Remove all children
  // Calls `removeChild()` on every child of the entity.
  TANK.Entity.prototype.removeAllChildren = function()
  {
    for (var i in this._children)
      this.removeChild(this._children[i]);
  };

  // ## Remove self from parent
  // Equivalent to calling entity.parent.removeChild(entity)
  TANK.Entity.prototype.removeSelf = function()
  {
    this._parent.removeChild(this);
  };

  // ## Dispatch an event to listeners
  // Dispatches an event to all listening Components.
  //
  // `eventName` - The name of the event to dispatch
  //
  // `...args` - Any number of arguments to pass with the event
  TANK.Entity.prototype.dispatch = function(eventName)
  {
    eventName = eventName.toLowerCase();

    // Copy arguments and pop off the event name
    var args = Array.prototype.slice.call(arguments, 1, arguments.length);

    // Dispatch the event to listeners
    var listeners = this._events[eventName];
    if (!listeners)
      return this;
    for (var i = 0; i < listeners.length; ++i)
    {
      var evt = listeners[i];
      evt.func.apply(evt.self, args);
    }
  };

  // ## Dispatch a deferred event
  // Schedules an event to be dispatched to all listening
  // Components on the next frame.
  //
  // `eventName` - The name of the event to dispatch
  //
  // `...args` - Any number of arguments to pass with the event
  TANK.Entity.prototype.dispatchNextFrame = function(eventName)
  {
    var args = Array.prototype.slice.call(arguments);
    var pendingEvent = {eventName: eventName, args: args, time: 0};
    this._pendingEvents.push(pendingEvent);
  };

  // ## Dispatch a timed event
  // Schedules an event to be dispatched to all listening
  // Components after a specified amount of time.
  //
  // `time` - The time, in seconds, to wait before dispatching
  // the event
  //
  // `eventName` - The name of the event to dispatch
  //
  // `...args` - Any number of arguments to pass with the event
  TANK.Entity.prototype.dispatchTimed = function(time, eventName)
  {
    var args = Array.prototype.slice.call(arguments, 1, arguments.length);
    var pendingEvent = {eventName: eventName, args: args, time: time};
    this._pendingEvents.push(pendingEvent);
  };

})(typeof exports === 'undefined' ? (this.TANK = this.TANK || {}) : exports);
// A mapping of the set of default events that TANK dispatches
(function(TANK)
{
  "use strict";
  TANK.Event = TANK.Event || {};

  // ## Main events

  // ## Start
  // Dispatched when `TANK.start()` is called, after the main entity is initialized.
  TANK.Event.start = "start";

  // ## Entity events

  // ## Child added
  // Dispatched when a child is added to an entity.
  // The child entity is passed as a parameter.
  TANK.Event.childAdded = "childadded";

  // ## Child removed
  // Dispatched when a child is removed from an entity.
  // The child entity is passed as a parameter.
  TANK.Event.childRemoved = "childremoved";

  // ## Component added
  // Dispatched when a component is added to an entity.
  // The component instance is passed as a parameter.
  TANK.Event.componentAdded = "componentadded";

  // ## Component removed
  // Dispatched when a component is removed from an entity.
  // The component instance is passed as a parameter.
  TANK.Event.componentRemoved = "componentremoved";

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
// Defines for popular keycodes
(function(TANK)
{
  "use strict";

  TANK.Key = {};

  // ## Mouse buttons
  TANK.Key.LEFT_MOUSE = 0;
  TANK.Key.MIDDLE_MOUSE = 1;
  TANK.Key.RIGHT_MOUSE = 2;

  // ## Special keys
  TANK.Key.LEFT_ARROW = 37;
  TANK.Key.UP_ARROW = 38;
  TANK.Key.RIGHT_ARROW = 39;
  TANK.Key.DOWN_ARROW = 40;
  TANK.Key.SHIFT = 16;
  TANK.Key.BACKSPACE = 8;
  TANK.Key.ESCAPE = 27;
  TANK.Key.SPACE = 32;
  TANK.Key.CONTROL = 17;
  TANK.Key.ALT = 18;
  TANK.Key.SUPER = 91;
  TANK.Key.TILDE = 192;

  // ## Letters
  TANK.Key.A = 65;
  TANK.Key.B = 66;
  TANK.Key.C = 67;
  TANK.Key.D = 68;
  TANK.Key.E = 69;
  TANK.Key.F = 70;
  TANK.Key.G = 71;
  TANK.Key.H = 72;
  TANK.Key.I = 73;
  TANK.Key.J = 74;
  TANK.Key.K = 75;
  TANK.Key.L = 76;
  TANK.Key.M = 77;
  TANK.Key.N = 78;
  TANK.Key.O = 79;
  TANK.Key.P = 80;
  TANK.Key.Q = 81;
  TANK.Key.R = 82;
  TANK.Key.S = 83;
  TANK.Key.T = 84;
  TANK.Key.U = 85;
  TANK.Key.V = 86;
  TANK.Key.W = 87;
  TANK.Key.X = 88;
  TANK.Key.Y = 89;
  TANK.Key.Z = 90;

  // ## Number keys (not numpad)
  TANK.Key.NUM0 = 48;
  TANK.Key.NUM1 = 49;
  TANK.Key.NUM2 = 50;
  TANK.Key.NUM3 = 51;
  TANK.Key.NUM4 = 52;
  TANK.Key.NUM5 = 53;
  TANK.Key.NUM6 = 54;
  TANK.Key.NUM7 = 55;
  TANK.Key.NUM8 = 56;
  TANK.Key.NUM9 = 57;

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
(function(TANK)
{
  "use strict";

  TANK.Math2D = TANK.Math2D || {};

  // ## Get the length of a vector
  //
  // `v` - An array in the form [x, y]
  //
  // `return` - The length of the vector
  TANK.Math2D.length = function(v)
  {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  };

  // ## Get the squared length of a vector (faster)
  //
  // `v` - An array in the form [x, y]
  //
  // `return` - The squared length of the vector
  TANK.Math2D.lengthSquared = function(v)
  {
    return v[0] * v[0] + v[1] * v[1];
  };

  // ## Get the normalized form of a vector
  //
  // `v` - The vector to normalize
  //
  // `return` - The normalized vector
  TANK.Math2D.normalize = function(v)
  {
    return TANK.Math2D.scale(v, 1 / TANK.Math2D.length(v));
  };

  // ## Dot two vectors
  //
  // `v1` - An array in the form [x, y]
  //
  // `v2` - An array in the form [x, y]
  //
  // `return` - A scalar representing the dot product
  TANK.Math2D.dot = function(v1, v2)
  {
    return v1[0] * v2[0] + v1[1] * v2[1];
  };

  // ## Cross two vectors
  //
  // `v1` - An array in the form [x, y]
  //
  // `v2` - An array in the form [x, y]
  //
  // `return` - The magnitude of the cross product of v1*v2
  TANK.Math2D.cross = function(v1, v2)
  {
    return v1[0] * v2[1] - v1[1] * v2[0];
  };

  // ## Add two vectors
  //
  // `v1` - An array in the form [x, y]
  //
  // `v2` - An array in the form [x, y]
  //
  // `return` - The resulting vector [x, y]
  TANK.Math2D.add = function(v1, v2)
  {
    return [v1[0] + v2[0], v1[1] + v2[1]];
  };

  // ## Subtract two vectors
  //
  // `v1` - An array in the form [x, y]
  //
  // `v2` - An array in the form [x, y]
  //
  // `return` - The resulting vector v1 - v2 = [x, y]
  TANK.Math2D.subtract = function(v1, v2)
  {
    return [v1[0] - v2[0], v1[1] - v2[1]];
  };

  // ## Scale a vector
  //
  // `v` - An array in the form [x, y]
  //
  // `s` - The scalar to multiply with the vector
  //
  // `return` - The resulting vector [x, y]
  TANK.Math2D.scale = function(v, s)
  {
    return [v[0] * s, v[1] * s];
  };

  // ## Rotate a vector
  //
  // `v` - An array in the form [x, y]
  //
  // `r` - Amount in radians to rotate the vector
  //
  // `return` - The resulting vector [x, y]
  TANK.Math2D.rotate = function(p, r)
  {
    return [p[0] * Math.cos(r) - p[1] * Math.sin(r), p[1] * Math.cos(r) + p[0] * Math.sin(r)];
  };

  // ## Project a vector
  //
  // `v1` - Vector to project onto v2
  //
  // `v2` - Vector to project v1 onto
  //
  // `return` - The resulting vector [x, y]
  TANK.Math2D.project = function(v1, v2)
  {
    return TANK.Math2D.scale(v2, TANK.Math2D.dot(v2, v1) / TANK.Math2D.lengthSquared(v2));
  };

  // ## Project a point onto a line
  //
  // `p` - The point to project
  //
  // `linePos` - The origin point of the line
  //
  // `lineVec` - A vector denoting the direction of the line
  //
  // `return` - The projection of `p` onto the line
  TANK.Math2D.projectOntoLine = function(p, linePos, lineVec)
  {
    var lineVecNorm = TANK.Math2D.normalize(lineVec);
    return TANK.Math2D.add(linePos, TANK.Math2D.scale(lineVecNorm, TANK.Math2D.dot(TANK.Math2D.subtract(p, linePos), lineVecNorm)));
  };

  // ## Get distance between two points
  //
  // `p1` - An array in the form [x, y]
  //
  // `p2` - An array in the form [x, y]
  //
  // `return` - The scalar distance
  TANK.Math2D.pointDistancePoint = function(p1, p2)
  {
    return Math.sqrt((p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1]));
  };

  // ## Get distance from a point to a line
  //
  // `p` - The point
  //
  // `lineA` - The origin point of the line
  //
  // `lineB` - The end point of the line
  //
  // `isSegment` - Whether the line should be treated as a segment or an infinite line
  //
  // `return` - The scalar distance
  TANK.Math2D.pointDistanceLine = function(p, lineA, lineB, isSegment)
  {
    var lineVec = TANK.Math2D.subtract(lineB, lineA);
    var lengthSquared = TANK.Math2D.lengthSquared(lineVec);

    // lineA === lineB case
    if (lengthSquared === 0)
      return TANK.Math2D.pointDistancePoint(lineA, p);

    // Calculate t, the scalar along the line where the projection of p onto the line falls
    var t = TANK.Math2D.dot(TANK.Math2D.subtract(p, lineA), lineVec) / lengthSquared;

    // p is off the segment in the < 0 or > 1 cases
    if (isSegment)
    {
      if (t < 0)
        return TANK.Math2D.pointDistancePoint(p, lineA);
      else if (t > 1)
        return TANK.Math2D.pointDistancePoint(p, lineB);
    }

    // p is on the segment
    var projection = TANK.Math2D.projectOntoLine(p, lineA, lineVec);
    return TANK.Math2D.pointDistancePoint(p, projection);
  };

  // ## Test a point against an AABB
  // Test if a given point is inside a rectangle
  //
  // `point` - An array in the form [x, y]
  //
  // `center` - The center point of the rectangle in the form [x, y]
  //
  // `size` - The size of the rectangle in the form [width, height]
  //
  // `return` - True if the point is inside the AABB
  TANK.Math2D.pointInAABB = function(point, center, size)
  {
    var halfSize = [size[0] / 2, size[1] / 2];
    if (point[0] < center[0] - halfSize[0] || point[1] < center[1] - halfSize[1])
      return false;
    if (point[0] > center[0] + halfSize[0] || point[1] > center[1] + halfSize[1])
      return false;
    return true;
  };

  // ## Test a point against an OBB
  // Test if a given point is inside an oriented box.
  //
  // `point` - An array in the form [x, y]
  //
  // `center` - The center point of the box in the form [x, y]
  //
  // `size` - The size of the box in the form [width, height]
  //
  // `angle` - The rotation of the box, in radians
  //
  // `return` - True if the point is inside the OBB
  TANK.Math2D.pointInOBB = function(point, center, size, angle)
  {
    var pointRot = [];
    pointRot[0] = (point[0] - center[0]) * Math.cos(-angle) - (point[1] - center[1]) * Math.sin(-angle) + center[0];
    pointRot[1] = (point[0] - center[0]) * Math.sin(-angle) + (point[1] - center[1]) * Math.cos(-angle) + center[1];
    return TANK.Math2D.pointInAABB(pointRot, center, size);
  };

  // ## Test an AABB against an AABB
  // Test if a given rectangle is intersecting another rectangle
  //
  // `centerA` - The center point of the first rectangle in the form [x, y]
  //
  // `sizeA` - The size of the first rectangle in the form [width, height]
  //
  // `centerB` - The center point of the second rectangle in the form [x, y]
  //
  // `sizeB` - The size of the second rectangle in the form [width, height]
  //
  // `return` - True if there is an intersection
  TANK.Math2D.AABBInAABB = function(centerA, sizeA, centerB, sizeB)
  {
    // Right side is left of left side
    if (centerA[0] + sizeA[0] / 2 < centerB[0] - sizeB[0] / 2)
      return false;

    // Bottom side is above top side
    if (centerA[1] + sizeA[1] / 2 < centerB[1] - sizeB[1] / 2)
      return false;

    // Left side is right of right side
    if (centerA[0] - sizeA[0] / 2 > centerB[0] + sizeB[0] / 2)
      return false;

    // Top side is below bottom side
    if (centerA[1] - sizeA[1] / 2 > centerB[1] + sizeB[1] / 2)
      return false;

    return true;
  };

  // ## Line intersecting
  // Get the point of intersection, if any, between two line segments.
  //
  // `line1A` - Point A on the first line, in the form [x, y]
  //
  // `line1B` - Point B on the first line, in the form [x, y]
  //
  // `line2A` - Point A on the second line, in the form [x, y]
  //
  // `line2B` - Point B on the second line, in the form [x, y]
  //
  // `return` - A point in the form [x, y]
  TANK.Math2D.lineIntersection = function(line1A, line1B, line2A, line2B)
  {
    var r = [line1B[0] - line1A[0], line1B[1] - line1A[1]];
    var rlen = TANK.Math2D.pointDistancePoint(line1A, line1B);
    r[0] /= rlen;
    r[1] /= rlen;

    var s = [line2B[0] - line2A[0], line2B[1] - line2A[1]];
    var slen = TANK.Math2D.pointDistancePoint(line2A, line2B);
    s[0] /= slen;
    s[1] /= slen;

    // Solve for
    // line2A + s * u = line1A + r * t;
    // t = (line1A - line2A) x s / (r x s);
    // u = (line1A - line2A) x r / (r x s);
    var vec = [line2A[0] - line1A[0], line2A[1] - line1A[1]];
    var t = (vec[0] * s[1] - vec[1] * s[0]) / (r[0] * s[1] - r[1] * s[0]);
    var u = (vec[0] * r[1] - vec[1] * r[0]) / (r[0] * s[1] - r[1] * s[0]);

    if (t >= 0 && t <= rlen && u >= 0 && u <= slen)
      return [line1A[0] + r[0] * t, line1A[1] + r[1] * t];

    return null;
  };

  // ## Get direction to point
  // Check if a point is to the left or right of a vector using
  // the cross product.
  //
  // `posA` - The first point in the form [x, y]
  //
  // `rotationA` - The angle of the vector, in radians
  //
  // `posB` - The point to get the direction to, in form [x, y]
  //
  // `return` - A negative value if the direction is left, and a positive
  // value if the direction is right. The return will be 0 if the vector
  // is facing directly at `posB`.
  TANK.Math2D.getDirectionToPoint = function(posA, rotationA, posB)
  {
    var dir = [Math.cos(rotationA), Math.sin(rotationA)];
    var targetAngle = Math.atan2(posB[1] - posA[1], posB[0] - posA[0]);
    var targetDir = [Math.cos(targetAngle), Math.sin(targetAngle)];
    return dir[0] * targetDir[1] - dir[1] * targetDir[0];
  };

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
// The MIT License (MIT)
//
// Copyright (c) 2013 David Evans
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// ## Serializer
// Serializers are simple classes that all conform to a single interface, and
// either read or write data to a particular format. Currently there are only
// serializers for reading and writing JSON objects, but any format could be
// supported in the future.

// The serializer interface is as follows.
// `void Serializer.property(obj, propertyName, defaultValue)`
// Serializes (reads or writes) a single property of an object.
// `obj` - The object to serialize a property of.
// `propertyName` - The string name of the property to serialize.
// `defaultValue` - A value to serialize into the property if none is specified. Note that
// this only has meaning in the case of reading.
//
// `string Serializer.mode`
// Defines whether the current mode of the serializer is `read` or `write`. Useful in the case where
// your object needs to serialize different things depending on the mode.
(function(TANK)
{
  // ## Write Serializer
  TANK.WriteSerializer = function()
  {
    this.mode = 'write';
    this._writeObj = {};
  };

  TANK.WriteSerializer.prototype.property = function(obj, propertyName, defaultValue)
  {
    this._writeObj[propertyName] = obj[propertyName];
  };

  // ## Read Serializer
  TANK.ReadSerializer = function(readObj)
  {
    this.mode = 'read';
    this._readObj = readObj;
  };

  TANK.ReadSerializer.prototype.property = function(obj, propertyName, defaultValue)
  {
    var val = this._readObj[propertyName];
    obj[propertyName] = typeof val !== 'undefined' ? val : defaultValue;
  };

})(typeof exports === "undefined" ? (this.TANK = this.TANK || {}) : exports);
/*! This file exists for documention purposes */
// # TankJS
// TANK is a lightweight Javascript engine framework focused on the following ideas:
//
// - Modular
// - Small
// - Made for programmers
//
// TANK is still in early development, but it is already usable! To get started, pull the repository and take a look at the `samples/` directory, or read the [docs](http://phosphoer.github.io/TankJS). More documentation will be written as the framework matures. TANK is similar to [Crafty](http://craftyjs.com/) but strives to be more flexible, and is more of a *framework* than an engine.
//
// #Features
//
// ### [Components](Component.html)
// Rather than using an inheritance tree, TANK uses a component-based architecture. In this model, you write lots of small, modular components that can be attached to any object to create custom behaviors quickly.
//
// ### [Entities](Entity.html)
// An Entity at its heart is simply a container for components. Most things in your game will be an entity with some assortment of components attached to it.
//
// ### [Events](Events.html)
// All Components can listen to Entities for events. For example, each Entity will dispatch the 'childadded' event when a child is added.
