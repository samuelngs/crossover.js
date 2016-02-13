'use strict';

import Render from '../core/render';

let {
  v,
  redraw,
  component,
} = Render;

const prevPropsKey = {};
const pendingPropsKey = {};
const prevStateKey = {};
const pendingStateKey = {};
const propsKey = {};
const stateKey = {};
const eventKey = {};
const elementKey = {};
const renderedKey = {};
const parentKey = {};

/**
 * Vaniila Component
 */
class Component {

  /**
   * @constructor
   */
  constructor(props = {}, children = null) {

    this.store = new WeakMap();

    if (children) {
      props.children = children;
    }

    this.props = {
      ...this.getDefaultProps(),
      ...props,
    };

    this.state = {
      ...this.getInitialState(),
    };

    this.store.set(prevPropsKey, this.props);
    this.store.set(pendingPropsKey, null);
    this.store.set(prevStateKey, this.state);
    this.store.set(pendingStateKey, null);
  }

  /**
   * The props of the component.
   *
   * @type Object
   * @public
   */
  get props() {
    return this.store.get(propsKey);
  }

  set props(newProps) {
    this.store.set(propsKey, newProps);
  }

  /**
   * The states of the component.
   *
   * @type Object
   * @public
   */
  get state() {
    return this.store.get(stateKey);
  }

  set state(newState) {
    this.store.set(stateKey, newState);
  }

  /**
   * The registered events of the component.
   *
   * @type Object
   * @public
   */
  get events() {
    return this.store.get(eventKey);
  }

  set events(newEvents) {
    this.store.set(eventKey, newEvents);
  }

  /**
   * The context of the component.
   *
   * @type Object
   * @read-only
   * @public
   */
  get context() {
    return this;
  }

  /**
   * The root DOM element for the component.
   *
   * @type DOMElement
   * @public
   */
  get element() {
    return this.store.get(elementKey);
  }

  set element(el) {
    this.store.set(elementKey, el);
  }

  /**
   * The component render state
   *
   * @type Object
   * @private
   */
  get rendered() {
    return this.store.get(renderedKey);
  }

  set rendered(rendered) {
    this.store.set(renderedKey, rendered);
  }

  /**
   * The result of getDefaultProps() will be cached and used to
   * ensure that this.props.value will have a value if it was not
   * specified by the parent component. This allows you to safely
   * just use your props without having to write repetitive and
   * fragile code to handle that yourself.
   */
  getDefaultProps() {
    return {};
  }

  getInitialState() {
    return {};
  }

  setState(state = {}, callback = (() => {})) {

    // cache current state
    this.store.set(prevStateKey, {...this.state});

    if (typeof state === 'function') {
      state = state(this.state, this.props);
    }

    if (state === null || typeof state !== 'object') {
      state = {};
    }

    // generate updated state object
    const updatedState = {
      ...this.state,
      ...state,
    };

    this.store.set(pendingStateKey, updatedState);

    let pendingProps = this.store.get(pendingPropsKey) || {...this.props};
    let pendingState = this.store.get(pendingStateKey) || {...this.state};

    // called componentWillUpdate before changing the component state
    this.componentWillUpdate(pendingProps, pendingState);

    // redraw
    this.redraw();

    // callback
    setTimeout(() => {
      callback.call(this);
    });
  }

  setProp(prop = {}, callback = (() => {})) {

    // cache current state
    this.store.set(prevPropsKey, {...this.prop});

    // generate updated prop object
    const updatedProp = {
      ...this.prop,
      ...prop,
    };

    this.store.set(pendingPropsKey, updatedProp);

    let pendingProps = this.store.get(pendingPropsKey) || {...this.props};
    let pendingState = this.store.get(pendingStateKey) || {...this.state};

    // called componentWillUpdate before changing the component state
    this.componentWillUpdate(pendingProps, pendingState);

    // redraw
    this.redraw();

    // callback
    setTimeout(() => {
      callback.call(this);
    });
  }

  /**
   * Component view
   *
   * @api private
   */
  view() {

    let vdom;

    if (typeof vdom === 'string') {
      return vdom;
    }

    if (!this.rendered) {
      vdom = this.render();
      this.injectDOM(vdom);
      return vdom;
    }

    let pendingProps = this.store.get(pendingPropsKey) || this.props;
    let pendingState = this.store.get(pendingStateKey) || this.state;

    // called componentWillUpdate before changing the component state
    const shouldRedraw = this.shouldComponentUpdate(pendingProps, pendingState);

    // update props and state
    this.props = {
      ...this.props,
      ...pendingProps,
    };
    this.state = {
      ...this.state,
      ...pendingState,
    };

    this.store.set(pendingPropsKey, null);
    this.store.set(pendingStateKey, null);

    if (shouldRedraw) {
      vdom = this.render();
      this.injectDOM(vdom);
      return vdom;
    }

    return {
      subtree: 'retain'
    };
  }

  /**
   * Inject component virtual dom for attaching componentWillConfig,
   * componentWillMount, etc... events
   *
   * @api private
   */
  injectDOM(vdom = this.render()) {
    // Override the root element's config attribute with our own function, which
    // will set the component instance's element property to the root DOM
    // element, and then run the component class' config method.
    vdom.attrs = vdom.attrs || {};

    const originalConfig = vdom.attrs.config;

    vdom.attrs.config = (...args) => {
      this.element = args[0];
      this.componentWillConfig.apply(this, args.slice(1));
      if (originalConfig) originalConfig.apply(this, args);
    };

    return vdom;
  }

  /**
   * Get the renderable virtual DOM that represents the component's view.
   *
   * @api public
   */
  render() {
    throw new Error('Component#render must be implemented by subclass');
  }

  /**
   * Calling m.redraw triggers a redraw regardless of whether AJAX requests
   * (and other asynchronous services) are completed. Therefore, you should
   * ensure that templates have null checks in place to account for the
   * possibility of variables being uninitialized when the forced redraw
   * occurs.
   *
   * @see https://lhorie.github.io/mithril/mithril.redraw.html
   *
   * @public
   */
  redraw() {
    setTimeout(() => {
      redraw();
      this.componentDidUpdate(this.store.get(prevPropsKey), this.store.get(prevStateKey));
    }, 0);
  }

  /**
   * Calling forceUpdate() will cause render() to be called on the component,
   * skipping shouldComponentUpdate(). This will trigger the normal lifecycle
   * methods for child components, including the shouldComponentUpdate() method
   * of each child. React will still only update the DOM if the markup changes.
   *
   * @api public
   */
  forceUpdate(callback) {
    setTimeout(() => {
      redraw(true);
    }, 0);
  }

  /**
   * If this component has been mounted into the DOM, this returns the
   * corresponding native browser DOM element. This method is useful for reading
   * values out of the DOM, such as form field values and performing DOM
   * measurements. When render returns null or false, this.getDOMNode() returns
   * null.
   *
   * @api public
   */
  getDOMNode() {
    return this.element;
  }

  /**
   * isMounted() returns true if the component is rendered into the DOM, false
   * otherwise. You can use this method to guard asynchronous calls to
   * setState() or forceUpdate().
   */
  isMounted() {
    return this.rendered;
  }

  /**
   * Called after the component's root element is redrawn. This hook can be used
   * to perform any actions on the DOM, both on the initial draw and any
   * subsequent redraws. See Mithril's documentation for more information.
   *
   * @see https://lhorie.github.io/mithril/mithril.html#the-config-attribute
   * @param {Boolean} isInitialized
   * @param {Object} context
   * @param {Object} vdom
   * @public
   */
  componentWillConfig(isInitialized, context, vdom) {
    if (!this.rendered) {
      this.componentWillMount();
    }
    if (!isInitialized) {
      this.rendered = true;
      this.componentDidMount();
    }
    context.onunload = this.componentWillUnmount;
  }

  /**
   * Invoked once, both on the client and server, immediately before the initial rendering occurs.
   * If you call setState within this method, render() will see the updated state and will be
   * executed only once despite the state change.
   *
   * @api public
   */
  componentWillMount() {}

  /**
   * Invoked once, only on the client (not on the server), immediately after the initial rendering
   * occurs. At this point in the lifecycle, you can access any refs to your children (e.g., to
   * access the underlying DOM representation). The componentDidMount() method of child components
   * is invoked before that of parent components.
   *
   * @api public
   */
  componentDidMount() {}

  /**
   * Invoked when a component is receiving new props. This method is not called for the initial
   * render.
   */
  componentWillReceiveProps() {}

  /**
   * Invoked immediately before rendering when new props or state are being received. This method
   * is not called for the initial render. Use this as an opportunity to perform preparation before
   * an update occurs.
   *
   * @api public
   */
  componentWillUpdate(nextProps, nextState) {}

  /**
   * Invoked immediately after the component's updates are flushed to the DOM. This method is not
   * called for the initial render. Use this as an opportunity to operate on the DOM when the
   * component has been updated.
   *
   * @api public
   */
  componentDidUpdate(prevProps, prevState) {}

  /**
   * Invoked immediately before a component is unmounted from the DOM.
   * Perform any necessary cleanup in this method, such as invalidating timers or cleaning up any
   * DOM elements that were created in componentDidMount.
   *
   * @api public
   */
  componentWillUnmount() {}


  /**
   * Mithril provides a component lifecycle function, shouldComponentUpdate, which is triggered
   * before the re-rendering process starts (virtual DOM comparison and possible eventual DOM
   * reconciliation), giving the developer the ability to short circuit this process. The default
   * implementation of this function returns true, leaving React to perform the update
   *
   * @api public
   */
  shouldComponentUpdate(nextProps, nextState) {
    return true;
  }

  /**
   * Child contexts allow an element to specify a context that applies to all of its children and
   * grandchildren. This is done through the childContextTypes and getChildContext properties.
   */
  getChildContext() {
    return {};
  }

  /**
   * mithril component module
   *
   * @api public
   */
  component(module) {
    return component(module, {
      context: {...this.getChildContext()},
      props: {...this.props},
    });
  }

}

/**
 * Occasionally, you want to pass data through the component tree without having to pass the
 * props down manually at every level. "context" feature lets you do this.
 */
Component.contextTypes = {};

/**
 * Child contexts allow an element to specify a context that applies to all of its children and
 * grandchildren. This is done through the childContextTypes and getChildContext properties.
 */
Component.childContextTypes = {};

export default Component;
