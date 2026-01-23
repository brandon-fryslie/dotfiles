# Files

## File: docs/kittens/broadcast.rst
```rst
broadcast
==================================================

.. only:: man

    Overview
    --------------

*Type text in all kitty windows simultaneously*

The ``broadcast`` kitten can be used to type text simultaneously in all
:term:`kitty windows <window>` (or a subset as desired).

To use it, simply create a mapping in :file:`kitty.conf` such as::

    map f1 launch --allow-remote-control kitty +kitten broadcast

Then press the :kbd:`F1` key and whatever you type in the newly created window
will be sent to all kitty windows.

You can use the options described below to control which windows are selected.

For example, only broadcast to other windows in the current tab::

    map f1 launch --allow-remote-control kitty +kitten broadcast --match-tab state:focused

.. program:: kitty +kitten broadcast


.. include:: /generated/cli-kitten-broadcast.rst
```

## File: docs/kittens/choose-files.rst
```rst
Selecting files, fast
========================

.. only:: man

    Overview
    --------------

.. versionadded:: 0.45.0

.. only:: not man

    .. figure:: /screenshots/choose-files.webp
        :alt: The choose files kitten, showing metadata and title from an e-book file
        :align: center
        :width: 100%


The choose-files kitten is designed to allow you to select files, very fast,
with just a few key strokes. It operates like `fzf
<https://github.com/junegunn/fzf/>`__ and similar fuzzy finders, except that
it is specialised for finding files. As such it supports features such as
filtering by file type, file type icons, content previews and
so on, out of the box. It can be used as a drop in (but much more efficient and
keyboard friendly) replacement for the :guilabel:`File open and save`
dialog boxes common to GUI programs. On Linux, with the help of the
:doc:`desktop-ui </kittens/desktop-ui>` kitten, you can even convince
most GUI programs on your computer to use this kitten instead of regular file
dialogs.

Simply run it as::

    kitten choose-files

to select a single file from the tree rooted at the current working directory.

Type a few letters from the filename and once it becomes the top selection,
press :kbd:`Enter`. You can change the current directory by selecting a
directory and pressing the :kbd:`Tab` key. :kbd:`Shift+Tab` goes up one
directory level.

If you want to choose a file and insert it into your shell prompt at the
current cursor position, press :sc:`insert_chosen_file` for files or
:sc:`insert_chosen_directory` for directories. Similarly, to have a file
chosen in a command line, use, for example::

    some-command $(kitten choose-file)

Note, that the above may not work in a complicated pipeline as it performs
terminal I/O and needs exclusive access to the tty device while choosing a
file.

Creating shortcuts to favorite/frequently used directories
------------------------------------------------------------

You can create keyboard shortcuts to quickly switch to any directory in
:file:`choose-files.conf`. For example:

.. code-block:: conf

   map ctrl+t cd /tmp
   map alt+p  cd ~/my/project

Selecting multiple files
-----------------------------

When you wish to select multiple files, start the kitten with :option:`--mode
<kitty +kitten choose_files --mode>`:code:`=files`. Then instead of pressing
:kbd:`Enter`, press :kbd:`Shift+Enter` instead and the file will be added to the list
of selections. You can also hold the :kbd:`Ctrl` key and click on files to add
them to the selections. Similarly, you can hold the :kbd:`Alt` key and click to
select ranges of files (similar to using :kbd:`Shift+click` in a GUI app).
Press :kbd:`Enter` on the last selected file to finish. The list of selected
files is displayed at the bottom of the kitten and you can click on them
to deselect a file. Similarly, pressing :kbd:`Shift+Enter` will un-select a
previously selected file.


Hidden and ignored files
--------------------------

By default, the kitten does not process hidden files and directories (whose
names start with a period). This can be :opt:`changed in the configuration <kitten-choose_files.show_hidden>`
and also at runtime via the clickable link to the right of the search input.

Similarly, the kitten respects both :file:`.gitignore` and :file:`.ignore`
files, by default. This can also be changed both :opt:`in configuration
<kitten-choose_files.respect_ignores>` or at runtime. Note that
:file:`.gitignore` files are only respected if there is also a :file:`.git`
directory present. The kitten also supports the global :file:`.gitignore` file,
though it applies only inside git working trees. You can specify :opt:`global ignore
patterns <kitten-choose_files.ignore>`, that apply everywhere in :file:`choose-files.conf`.


Selecting non-existent files (save file names)
-------------------------------------------------

This kitten can also be used to select non-existent files, that is a new file
for a :guilabel:`Save file` type of dialog using :option:`--mode <kitty +kitten
choose_files --mode>`:code:`=save-file`. Once you have changed to the directory
you want the file to be in (using the :kbd:`Tab` key),
press :kbd:`Ctrl+Enter` and you will be able to type in the file name.


Selecting directories
---------------------------

This kitten can also be used to select directories,
for an :guilabel:`Open directory` type of dialog using :option:`--mode <kitty +kitten
choose_files --mode>`:code:`=dir`. Once you have changed to the directory
you want, press :kbd:`Ctrl+Enter` to accept it. Or if you are in a parent
directory you can select a descendant directory by pressing :kbd:`Enter`, the
same as you would for selecting a file to open.


Configuration
------------------------

You can configure various aspects of the kitten's operation by creating a
:file:`choose-files.conf` in your :ref:`kitty config folder <confloc>`.
See below for the supported configuration directives.


.. include:: /generated/conf-kitten-choose_files.rst


.. include:: /generated/cli-kitten-choose_files.rst
```

## File: docs/kittens/choose-fonts.rst
```rst
Changing kitty fonts
========================

.. only:: man

    Overview
    --------------

Terminal aficionados spend all day staring at text, as such, getting text
rendering just right is very important. kitty has extremely powerful facilities
for fine-tuning text rendering. It supports `OpenType features
<https://en.wikipedia.org/wiki/List_of_typographic_features>`__ to select
alternate glyph shapes, and `Variable fonts
<https://en.wikipedia.org/wiki/Variable_font>`__ to control the weight or
spacing of a font precisely. You can also :opt:`select which font is used to
render particular unicode codepoints <symbol_map>` and you can :opt:`modify
font metrics <modify_font>` and even :opt:`adjust the gamma curves
<text_composition_strategy>` used for rendering text onto the background color.

The first step is to select the font faces kitty will use for rendering
regular, bold and italic text. kitty comes with a convenient UI for choosing fonts,
in the form of the *choose-fonts* kitten. Simply run::

    kitten choose-fonts

and follow the on screen prompts.

First, choose the family you want, the list of families can be easily filtered by
typing a few letters from the family name you are looking for. The family
selection screen shows you a preview of how the family looks.

.. image:: ../screenshots/family-selection.png
   :alt: Choosing a family with the choose fonts kitten
   :width: 600

Once you select a family by pressing the :kbd:`Enter` key, you
are shown previews of what the regular, bold and italic faces look like
for that family. You can choose to fine tune any of the faces. Start with
fine-tuning the regular face by pressing the :kbd:`R` key. The other styles
will be automatically adjusted based on what you select for the regular face.

.. image:: ../screenshots/font-fine-tune.png
   :alt: Fine tune a font by choosing a precise weight and features
   :width: 600

You can choose a specific style or font feature by clicking on it. A precise
value for any variable axes can be selected using the slider, in the screenshot
above, the font supports precise weight adjustment. If you are lucky the font
designer has included descriptive names for font features, which will be
displayed, if not, consult the documentation of the font to see what each feature does.

.. _font_spec_syntax:

The font specification syntax
--------------------------------

If you don't like the choose fonts kitten or simply want to understand and
write font selection options into :file:`kitty.conf` yourself, read on.

There are four font face selection keys: `font_family`, `bold_font`,
`italic_font` and `bold_italic_font`. Each of these supports the syntax
described below. Their values can be of three types, either a
font family name, the keyword ``auto`` or an extended ``key=value`` syntax
for specifying font selection precisely.

If a font family name is specified kitty will use Operating System APIs to
search for a matching font. The keyword ``auto`` means kitty will choose a font
completely automatically, typically this is used for automatically selecting
bold/italic variants once the :opt:`font_family` is set. The bold and italic
variants will then automatically use the same set of features as the main face.

To specify font face selection more precisely, a ``key=value`` syntax is used.
First, let's look at a few examples::

    # Select by family only, actual face selection is automatic
    font_family family="Fira Code"
    # Select an exact face by Postscript name
    font_family postscript_name=FiraCode
    # Select an exact face by family with features and variable weight
    font_family family=SourceCodeVF variable_name=SourceCodeUpright features="+zero cv01=2" wght=380

The following are the known keys, any other keys are names of *variable axes*,
that is, they are used to set the variable value for some font characteristic.

``family``
    A font family name. A family typically has multiple actual font faces, such
    as bold and italic variants. One or more of the faces can even be variable,
    allowing fine tuning of font characteristics.

``style``
    A style name to choose a particular font from a given family. Useful only
    with the ``family`` key, when no more precise methods for face selection
    are specified. Can also be used to specify a named variable style for
    variable fonts.

``postscript_name``
    The actual postscript name for a font face. This allows selecting a
    particular variant within a font family. But note that postscript names
    are usually insufficient for selecting variable fonts.

``full_name``
    This can be used to select a particular font face in a family. However, it
    is less precise than ``postscript_name`` and should not generally be used.

``variable_name``
    Some families with variable fonts actually contain multiple font files. For
    example, a family could have variable weights with one font file containing
    upright variable weight faces and another containing italic variable weight
    faces. Well designed fonts use a *variable name* to distinguish between
    such files. Should be used in conjunction with ``family`` to select a
    particular variable font file.

``features``
    A space separated list of OpenType font features to enable/disable or
    select a value of, for this font. Consult the documentation for the font
    family to see what features it supports and their effects. The exact syntax
    for specifying features is `documented by HarfBuzz
    <https://harfbuzz.github.io/harfbuzz-hb-common.html#hb-feature-from-string>`__

``system``
    This can be used to pass an arbitrary string, usually a family or full name
    to the OS font selection APIs. Should not be used in conjunction with any
    other keys. Is the same as specifying just the font name without any keys.


In addition to these keys, any four letter key is treated as the name of a
variable characteristic of the font. Its value is used to set the value for
the name.
```

## File: docs/kittens/clipboard.rst
```rst
clipboard
==================================================

.. only:: man

    Overview
    --------------

*Copy/paste to the system clipboard from shell scripts*

.. highlight:: sh


The ``clipboard`` kitten can be used to read or write to the system clipboard
from the shell. It even works over SSH. Using it is as simple as::

    echo hooray | kitten clipboard

All text received on :file:`STDIN` is copied to the clipboard.

To get text from the clipboard::

    kitten clipboard --get-clipboard

The text will be written to :file:`STDOUT`. Note that by default kitty asks for
permission when a program attempts to read the clipboard. This can be
controlled via :opt:`clipboard_control`.

.. versionadded:: 0.27.0
   Support for copying arbitrary data types

The clipboard kitten can be used to send/receive
more than just plain text from the system clipboard. You can transfer arbitrary
data types. Best illustrated with some examples::

    # Copy an image to the clipboard:
    kitten clipboard picture.png

    # Copy an image and some text to the clipboard:
    kitten clipboard picture.jpg text.txt

    # Copy text from STDIN and an image to the clipboard:
    echo hello | kitten clipboard picture.png /dev/stdin

    # Copy any raster image available on the clipboard to a PNG file:
    kitten clipboard -g picture.png

    # Copy an image to a file and text to STDOUT:
    kitten clipboard -g picture.png /dev/stdout

    # List the formats available on the system clipboard
    kitten clipboard -g -m . /dev/stdout

Normally, the kitten guesses MIME types based on the file names. To control the
MIME types precisely, use the :option:`--mime <kitty +kitten clipboard --mime>` option.

This kitten uses a new protocol developed by kitty to function, for details,
see :doc:`/clipboard`.

.. program:: kitty +kitten clipboard


.. include:: /generated/cli-kitten-clipboard.rst
```

## File: docs/kittens/custom.rst
```rst
Custom kittens
=================

You can easily create your own kittens to extend kitty. They are just terminal
programs written in Python. When launching a kitten, kitty will open an overlay
window over the current window and optionally pass the contents of the current
window/scrollback to the kitten over its :file:`STDIN`. The kitten can then
perform whatever actions it likes, just as a normal terminal program. After
execution of the kitten is complete, it has access to the running kitty instance
so it can perform arbitrary actions such as closing windows, pasting text, etc.

Let's see a simple example of creating a kitten. It will ask the user for some
input and paste it into the terminal window.

Create a file in the kitty config directory, :file:`~/.config/kitty/mykitten.py`
(you might need to adjust the path to wherever the :ref:`kitty config directory
<confloc>` is on your machine).


.. code-block:: python

    from kitty.boss import Boss

    def main(args: list[str]) -> str:
        # this is the main entry point of the kitten, it will be executed in
        # the overlay window when the kitten is launched
        answer = input('Enter some text: ')
        # whatever this function returns will be available in the
        # handle_result() function
        return answer

    def handle_result(args: list[str], answer: str, target_window_id: int, boss: Boss) -> None:
        # get the kitty window into which to paste answer
        w = boss.window_id_map.get(target_window_id)
        if w is not None:
            w.paste_text(answer)


Now in :file:`kitty.conf` add the lines::

    map ctrl+k kitten mykitten.py


Start kitty and press :kbd:`Ctrl+K` and you should see the kitten running.
The best way to develop your own kittens is to modify one of the built-in
kittens. Look in the `kittens sub-directory
<https://github.com/kovidgoyal/kitty/tree/master/kittens>`__ of the kitty source
code for those. Or see below for a list of :ref:`third-party kittens
<external_kittens>`, that other kitty users have created.

kitty API to use with kittens
-------------------------------

Kittens have full access to internal kitty APIs. However these are neither
entirely stable nor documented. You can instead use the kitty
:doc:`Remote control API </remote-control>`. Simply call
:code:`boss.call_remote_control()`, with the same arguments you
would pass to ``kitten @``. For example:

.. code-block:: python

    def handle_result(args: list[str], answer: str, target_window_id: int, boss: Boss) -> None:
        # get the kitty window to which to send text
        w = boss.window_id_map.get(target_window_id)
        if w is not None:
            boss.call_remote_control(w, ('send-text', f'--match=id:{w.id}', 'hello world'))

.. note::
   Inside handle_result() the active window is still the window in which the
   kitten was run, therefore when using call_remote_control() be sure to pass
   the appropriate option to select the target window, usually ``--match`` as
   shown above or ``--self``.


Run, ``kitten @ --help`` in a kitty terminal, to see all the remote control
commands available to you.

Passing arguments to kittens
------------------------------

You can pass arguments to kittens by defining them in the map directive in
:file:`kitty.conf`. For example::

    map ctrl+k kitten mykitten.py arg1 arg2

These will be available as the ``args`` parameter in the ``main()`` and
``handle_result()`` functions. Note also that the current working directory
of the kitten is set to the working directory of whatever program is running in
the active kitty window. The special argument ``@selection`` is replaced by the
currently selected text in the active kitty window.


Passing the contents of the screen to the kitten
---------------------------------------------------

If you would like your kitten to have access to the contents of the screen
and/or the scrollback buffer, you just need to add an annotation to the
``handle_result()`` function, telling kitty what kind of input your kitten would
like. For example:

.. code-block:: py

    from kitty.boss import Boss

    # in main, STDIN is for the kitten process and will contain
    # the contents of the screen
    def main(args: list[str]) -> str:
        return sys.stdin.read()

    # in handle_result, STDIN is for the kitty process itself, rather
    # than the kitten process and should not be read from.
    from kittens.tui.handler import result_handler
    @result_handler(type_of_input='text')
    def handle_result(args: list[str], stdin_data: str, target_window_id: int, boss: Boss) -> None:
        pass


This will send the plain text of the active window to the kitten's
:file:`STDIN`. There are many other types of input you can ask for, described in
the table below:

.. table:: Types of input to kittens
    :align: left

    =========================== ========================================================================================
    Keyword                     Type of :file:`STDIN` input
    =========================== ========================================================================================
    ``text``                    Plain text of active window
    ``ansi``                    Formatted text of active window
    ``screen``                  Plain text of active window with line wrap markers
    ``screen-ansi``             Formatted text of active window with line wrap markers

    ``history``                 Plain text of active window and its scrollback
    ``ansi-history``            Formatted text of active window and its scrollback
    ``screen-history``          Plain text of active window and its scrollback with line wrap markers
    ``screen-ansi-history``     Formatted text of active window and its scrollback with line wrap markers

    ``output``                  Plain text of the output from the last run command
    ``output-screen``           Plain text of the output from the last run command with wrap markers
    ``output-ansi``             Formatted text of the output from the last run command
    ``output-screen-ansi``      Formatted text of the output from the last run command with wrap markers

    ``selection``               The text currently selected with the mouse
    =========================== ========================================================================================

In addition to ``output``, that gets the output of the last run command,
``last_visited_output`` gives the output of the command last jumped to
and ``first_output`` gives the output of the first command currently on screen.
These can also be combined with ``screen`` and ``ansi`` for formatting.

.. note::
   For the types based on the output of a command, :ref:`shell_integration` is
   required.


Using kittens to script kitty, without any terminal UI
-----------------------------------------------------------

If you would like your kitten to script kitty, without bothering to write a
terminal program, you can tell the kittens system to run the ``handle_result()``
function without first running the ``main()`` function.

For example, here is a kitten that "zooms in/zooms out" the current terminal
window by switching to the stack layout or back to the previous layout. This is
equivalent to the builtin :ac:`toggle_layout` action.

Create a Python file in the :ref:`kitty config directory <confloc>`,
:file:`~/.config/kitty/zoom_toggle.py`

.. code-block:: py

    from kitty.boss import Boss

    def main(args: list[str]) -> str:
        pass

    from kittens.tui.handler import result_handler
    @result_handler(no_ui=True)
    def handle_result(args: list[str], answer: str, target_window_id: int, boss: Boss) -> None:
        tab = boss.active_tab
        if tab is not None:
            if tab.current_layout.name == 'stack':
                tab.last_used_layout()
            else:
                tab.goto_layout('stack')


Now in :file:`kitty.conf` add::

    map f11 kitten zoom_toggle.py

Pressing :kbd:`F11` will now act as a zoom toggle function. You can get even
more fancy, switching the kitty OS window to fullscreen as well as changing the
layout, by simply adding the line::

    boss.toggle_fullscreen()


to the ``handle_result()`` function, above.


.. _send_mouse_event:

Sending mouse events
--------------------

If the program running in a window is receiving mouse events, you can simulate
those using::

    from kitty.fast_data_types import send_mouse_event
    send_mouse_event(screen, x, y, button, action, mods)

``screen`` is the ``screen`` attribute of the window you want to send the event
to. ``x`` and ``y`` are the 0-indexed coordinates. ``button`` is a number using
the same numbering as X11 (left: ``1``, middle: ``2``, right: ``3``, scroll up:
``4``, scroll down: ``5``, scroll left: ``6``, scroll right: ``7``, back:
``8``, forward: ``9``). ``action`` is one of ``PRESS``, ``RELEASE``, ``DRAG``
or ``MOVE``. ``mods`` is a bitmask of ``GLFW_MOD_{mod}`` where ``{mod}`` is one
of ``SHIFT``, ``CONTROL`` or ``ALT``. All the mentioned constants are imported
from ``kitty.fast_data_types``.

For example, to send a left click at position x: 2, y: 3 to the active window::

    from kitty.fast_data_types import send_mouse_event, PRESS
    send_mouse_event(boss.active_window.screen, 2, 3, 1, PRESS, 0)

The function will only send the event if the program is receiving events of
that type, and will return ``True`` if it sent the event, and ``False`` if not.


.. _kitten_main_rc:

Using remote control inside the main() kitten function
------------------------------------------------------------

You can use kitty's remote control features inside the main() function of a
kitten, even without enabling remote control. This is useful if you want to
probe kitty for more information before presenting some UI to the user or if
you want the user to be able to control kitty from within your kitten's UI
rather than after it has finished running. To enable it, simply tell kitty your kitten
requires remote control, as shown in the example below::

    import json
    import sys
    from pprint import pprint

    from kittens.tui.handler import kitten_ui

    @kitten_ui(allow_remote_control=True)
    def main(args: list[str]) -> str:
        # get the result of running kitten @ ls
        cp = main.remote_control(['ls'], capture_output=True)
        if cp.returncode != 0:
            sys.stderr.buffer.write(cp.stderr)
            raise SystemExit(cp.returncode)
        output = json.loads(cp.stdout)
        pprint(output)
        # open a new tab with a title specified by the user
        title = input('Enter the name of tab: ')
        window_id = main.remote_control(['launch', '--type=tab', '--tab-title', title], check=True, capture_output=True).stdout.decode()
        return window_id

:code:`allow_remote_control=True` tells kitty to run this kitten with remote
control enabled, regardless of whether it is enabled globally or not.
To run a remote control command use the :code:`main.remote_control()` function
which is a thin wrapper around Python's :code:`subprocess.run` function. Note
that by default, for security, child processes launched by your kitten cannot use remote
control, thus it is necessary to use :code:`main.remote_control()`. If you wish
to enable child processes to use remote control, call
:code:`main.allow_indiscriminate_remote_control()`.

Remote control access can be further secured by using
:code:`kitten_ui(allow_remote_control=True, remote_control_password='ls set-colors')`.
This will use a secure generated password to restrict remote control.
You can specify a space separated list of remote control commands to allow, see
:opt:`remote_control_password` for details. The password value is accessible
as :code:`main.password` and is used by :code:`main.remote_control()`
automatically.


Debugging kittens
--------------------

The part of the kitten that runs in ``main()`` is just a normal program and the
output of print statements will be visible in the kitten window. Or alternately,
you can use::

    from kittens.tui.loop import debug
    debug('whatever')

The ``debug()`` function is just like ``print()`` except that the output will
appear in the ``STDOUT`` of the kitty process inside which the kitten is
running.

The ``handle_result()`` part of the kitten runs inside the kitty process.
The output of print statements will go to the ``STDOUT`` of the kitty process.
So if you run kitty from another kitty instance, the output will be visible
in the first kitty instance.


Developing builtin kittens for inclusion with kitty
----------------------------------------------------------

There is documentation for :doc:`developing-builtin-kittens` which are written in the Go
language.


.. _external_kittens:

Kittens created by kitty users
---------------------------------------------

`vim-kitty-navigator <https://github.com/knubie/vim-kitty-navigator>`_
    Allows you to navigate seamlessly between vim and kitty splits using a
    consistent set of hotkeys.

`smart-scroll <https://github.com/yurikhan/kitty-smart-scroll>`_
    Makes the kitty scroll bindings work in full screen applications

`kitty-tab-switcher <https://github.com/OsiPog/kitty-tab-switcher>`__
    Fuzzy finder for kitty tabs with previews

`gattino <https://github.com/salvozappa/gattino>`__
    Integrate kitty with an LLM to convert plain language prompts into shell commands.

:iss:`insert password <1222>`
    Insert a password from a CLI password manager, taking care to only do it at
    a password prompt.

`weechat-hints <https://github.com/GermainZ/kitty-weechat-hints>`_
    URL hints kitten for WeeChat that works without having to use WeeChat's
    raw-mode.
```

## File: docs/kittens/desktop-ui.rst
```rst
Using terminal programs to provide Linux desktop components
===============================================================

.. only:: man

    Overview
    --------------

.. versionadded:: 0.43.0

Power users of terminals on Linux also often like to use bare bones window
managers instead of full fledged desktop environments. This kitten helps
provide parts of the desktop environment that are missing from such setups,
and does so using keyboard friendly, terminal first UI components. Some of its
features are:

* Replace the typical File Open/Save dialogs used in GUI programs with the
  fast and keyboard centric :doc:`choose-files </kittens/choose-files>` kitten
  running in a semi-transparent kitty overlay.

* Allow simple command line based management of the desktop light/dark modes.


How to install
-------------------

.. note::

   This kitten relies on the :doc:`panel kitten </kittens/panel>`
   under the hood to supply UI components. Check :ref:`the documentation <panel_compat>`
   of that kitten to see if your window manager works with it.

First, run::

    kitten desktop-ui enable-portal

Then, set the following two environment variables, *system wide*, that means in
:file:`/etc/environment` or the equivalent for your distribution::

    QT_QPA_PLATFORMTHEME=xdgdesktopportal
    GTK_USE_PORTAL=1


Finally, reboot. Now, when you open a file dialog in most GUI applications, it
should open the :doc:`choose-files kitten </kittens/choose-files>` instead
of a normal file open dialog. You can change the current light/dark mode of
your desktop by running::

    kitten desktop-ui set-color-scheme dark
    kitten desktop-ui set-color-scheme light

Check the current value using::

    dbus-send --session --print-reply --dest=org.freedesktop.portal.Desktop /org/freedesktop/portal/desktop org.freedesktop.portal.Settings.Read string:org.freedesktop.appearance string:color-scheme

How it works
----------------

Modern Linux desktops have so called `portals
<https://flatpak.github.io/xdg-desktop-portal/docs/index.html>`__ that were
invented for sandboxed applications and provide various facilities to such
applications over DBUS, including file open dialogs, common desktop settings,
etc. This kitten works by implementing a backend for some of these services.

Normal GUI applications can then be told to make use of these services, thereby
allowing us to replace parts of the desktop experience as needed.

There are multiple competing implementations of the backends. Each desktop
environment like KDE or GNOME has it's own backend and many window managers
provide implementations for some backends as well. Service discovery and
configuring which backend to use happens via the :file:`xdg-desktop-portal`
program, usually found at :file:`/usr/lib/xdg-desktop-portal`.

It can be configured by files in :file:`~/.local/share/xdg-desktop-portal`. See
`man portals.conf <https://man.archlinux.org/man/portals.conf.5>`__. The
``kitten desktop-ui enable-portal`` command takes care of the setup for you
automatically. If you want to customize exactly which services to use this
kitten for, run the command and then edit the conf file that the command says
it has patched.


Troubleshooting
-------------------

First, ensure that DBUS is able to auto-start the kitten when it is needed. If
the kitten is not already running, try the following command::

    dbus-send --session --print-reply --dest=org.freedesktop.impl.portal.desktop.kitty \
        /net/kovidgoyal/kitty/portal org.freedesktop.DBus.Properties.GetAll \
        string:net.kovidgoyal.kitty.settings

If DBUS is able to start the kitten or if it is already running it will print
out the version property, otherwise it will fail with an error. If it fails,
check the file
:file:`~/.local/share/dbus-1/services/org.freedesktop.impl.portal.desktop.kitty.service`
that should have been created by the ``enable-portal`` command. It's ``Exec``
key must point to the full path to the kitten executable.

Next, check that the XDG portal system is actually using this kitten for its
settings backend. Run::

    dbus-send --session --print-reply --dest=org.freedesktop.portal.Desktop \
        /org/freedesktop/portal/desktop org.freedesktop.portal.Settings.Read \
        string:net.kovidgoyal.kitty string:status

If this returns a reply then the kitten is being used, as expected. If it
returns a not found error, then some other backend is being used for settings.

Read the ``portals.conf`` man page and run::

    /usr/lib/xdg-desktop-portal -r v

this will output a lot of debug information, which should tell you which
backend is chosen for which service. Read the debug output carefully to
determine why the kitten is not being selected.

If some GUI applications are not using the choose-files kitten for their file
select dialogs, then make sure the environment variables mentioned above are
set, you can also try running the the GUI application with them set explicitly,
as::

    QT_QPA_PLATFORMTHEME=xdgdesktopportal GTK_USE_PORTAL=1 my-gui-app

Note that not all applications use portals, so if some particular application
is failing to use the portal but others work, report the issue to that
applications' developers.
```

## File: docs/kittens/developing-builtin-kittens.rst
```rst
Developing builtin kittens
=============================

Builtin kittens in kitty are written in the Go language, with small Python
wrapper scripts to define command line options and handle UI integration.

Getting started
-----------------------

To get started with creating a builtin kitten, one that will become part of kitty
and be available as ``kitten my-kitten``, create a directory named
:file:`my_kitten` in the :file:`kittens` directory. Then, in this directory
add three, files: :file:`__init__.py` (an empty file), :file:`__main__.py` and
:file:`main.go`.

Template for `main.py`
^^^^^^^^^^^^^^^^^^^^^^

The file :file:`main.py` contains the command line option definitions for your kitten. Change the actual options and help text below as needed.

.. code-block:: python

    #!/usr/bin/env python
    # License: GPL v3 Copyright: 2018, Kovid Goyal <kovid at kovidgoyal.net>

    import sys

    # See the file kitty/cli.py in the kitty sourcecode for more examples of
    # the syntax for defining options
    OPTIONS = r'''
    --some-string-option -s
    default=my_default_value
    Help text for a simple option taking a string value.


    --some-boolean-option -b
    type=bool-set
    Help text for a boolean option defaulting to false.


    --some-inverted-boolean-option
    type=bool-unset
    Help text for a boolean option defaulting to true.


    --an-integer-option
    type=int
    default=13
    bla bla


    --an-enum-option
    choices=a,b,c,d
    default=a
    This option can only take the values a, b, c, or d
    '''.format

    help_text = '''\
    The introductory help text for your kitten.

    Can contain multiple paragraphs with :bold:`bold`
    :green:`colored`, :code:`code`, :link:`links <http://url>` etc.
    formatting.

    Option help strings can also use this formatting.
    '''

    # The usage string for your kitten
    usage = 'TITLE [BODY ...]'
    short_description = 'some short description of your kitten it will show up when running kitten without arguments to list all kittens`

    if __name__ == '__main__':
        raise SystemExit('This should be run as kitten my-kitten')
    elif __name__ == '__doc__':
        cd = sys.cli_docs  # type: ignore
        cd['usage'] = usage
        cd['options'] = OPTIONS
        cd['help_text'] = help_text
        cd['short_desc'] = short_description


Template for `main.go`
^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: go

    package my_kitten

    import (
        "fmt"

        "kitty/tools/cli"
    )

    var _ = fmt.Print

    func main(_ *cli.Command, opts *Options, args []string) (rc int, err error) {
        // Here rc is the exit code for the kitten which should be 1 or higher if err is not nil
        fmt.Println("Hello world!")
        fmt.Println(args)
        fmt.Println(fmt.Sprintf("%#v", opts))
        return
    }

    func EntryPoint(parent *cli.Command) {
        create_cmd(parent, main)
    }

Edit :file:`tools/cmd/tool/main.go`
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Add the entry point of the kitten into :file:`tools/cmd/tool/main.go`.

First, import the kitten into this file. To do this, add :code:`"kitty/kittens/my_kitten"` into the :code:`import ( ... )` section at the top.
Then, add ``my_kitten.EntryPoint(root)`` into ``func KittyToolEntryPoints(root *cli.Command)`` and you are done. After running make you should
be able to test your kitten by running::

    kitten my-kitten
```

## File: docs/kittens/diff.rst
```rst
kitty-diff
================================================================================

*A fast side-by-side diff tool with syntax highlighting and images*

.. highlight:: sh

Major Features
-----------------

.. container:: major-features

    * Displays diffs side-by-side in the kitty terminal

    * Does syntax highlighting of the displayed diffs, asynchronously, for
      maximum speed

    * Displays images as well as text diffs, even over SSH

    * Does recursive directory diffing


.. figure:: ../screenshots/diff.png
   :alt: Screenshot, showing a sample diff
   :align: center
   :width: 100%

   Screenshot, showing a sample diff


Installation
---------------

Simply :ref:`install kitty <quickstart>`.


Usage
--------

In the kitty terminal, run::

    kitten diff file1 file2

to see the diff between :file:`file1` and :file:`file2`.

Create an alias in your shell's startup file to shorten the command, for
example:

.. code-block:: sh

    alias d="kitten diff"

Now all you need to do to diff two files is::

    d file1 file2

You can also pass directories instead of files to see the recursive diff of the
directory contents.


Keyboard controls
----------------------

===========================       ===========================
Action                            Shortcut
===========================       ===========================
Quit                              :kbd:`Q`
Scroll line up                    :kbd:`K`, :kbd:`Up`
Scroll line down                  :kbd:`J`, :kbd:`Down`
Scroll page up                    :kbd:`PgUp`
Scroll page down                  :kbd:`PgDn`
Scroll to top                     :kbd:`Home`
Scroll to bottom                  :kbd:`End`
Scroll to next page               :kbd:`Space`, :kbd:`PgDn`, :kbd:`Ctrl+F`
Scroll to previous page           :kbd:`PgUp`, :kbd:`Ctrl+B`
Scroll down half page             :kbd:`Ctrl+D`
Scroll up half page               :kbd:`Ctrl+U`
Scroll to next change             :kbd:`N`
Scroll to previous change         :kbd:`P`
Increase lines of context         :kbd:`+`
Decrease lines of context         :kbd:`-`
All lines of context              :kbd:`A`
Restore default context           :kbd:`=`
Search forwards                   :kbd:`/`
Search backwards                  :kbd:`?`
Clear search or exit              :kbd:`Esc`
Scroll to next match              :kbd:`>`, :kbd:`.`
Scroll to previous match          :kbd:`<`, :kbd:`,`
Copy selection to clipboard       :kbd:`y`
Copy selection or exit            :kbd:`Ctrl+C`
===========================       ===========================


Integrating with git
-----------------------

Add the following to :file:`~/.gitconfig`:

.. code-block:: ini

    [diff]
        tool = kitty
        guitool = kitty.gui
    [difftool]
        prompt = false
        trustExitCode = true
    [difftool "kitty"]
        cmd = kitten diff $LOCAL $REMOTE
    [difftool "kitty.gui"]
        cmd = kitten diff $LOCAL $REMOTE

Now to use kitty-diff to view git diffs, you can simply do::

    git difftool --no-symlinks --dir-diff

Once again, creating an alias for this command is useful.


Why does this work only in kitty?
----------------------------------------

The diff kitten makes use of various features that are :doc:`kitty only
</protocol-extensions>`, such as the :doc:`kitty graphics protocol
</graphics-protocol>`, the :doc:`extended keyboard protocol
</keyboard-protocol>`, etc. It also leverages terminal program infrastructure
I created for all of kitty's other kittens to reduce the amount of code needed
(the entire implementation is under 3000 lines of code).

And fundamentally, it's kitty only because I wrote it for myself, and I am
highly unlikely to use any other terminals :)


Configuration
------------------------

You can configure the colors used, keyboard shortcuts, the diff implementation,
the default lines of context, etc. by creating a :file:`diff.conf` file in your
:ref:`kitty config folder <confloc>`. See below for the supported configuration
directives.


.. include:: /generated/conf-kitten-diff.rst


.. include:: /generated/cli-kitten-diff.rst


Sample diff.conf
-----------------

You can download a sample :file:`diff.conf` file with all default settings and
comments describing each setting by clicking: :download:`sample diff.conf
</generated/conf/diff.conf>`.
```

## File: docs/kittens/hints.rst
```rst
Hints
==========

.. only:: man

    Overview
    --------------


|kitty| has a *hints mode* to select and act on arbitrary text snippets
currently visible on the screen.  For example, you can press :sc:`open_url`
to choose any URL visible on the screen and then open it using your default web
browser.

.. figure:: ../screenshots/hints_mode.png
    :alt: URL hints mode
    :align: center
    :width: 100%

    URL hints mode

Similarly, you can press :sc:`insert_selected_path` to select anything that
looks like a path or filename and then insert it into the terminal, very useful
for picking files from the output of a :program:`git` or :program:`ls` command
and adding them to the command line for the next command.

You can also press :sc:`goto_file_line` to select anything that looks like a
path or filename followed by a colon and a line number and open the file in
your default editor at the specified line number (opening at line number will
work only if your editor supports the +linenum command line syntax or is a
"known" editor). The patterns and editor to be used can be modified using
options passed to the kitten. For example::

    map ctrl+g kitten hints --type=linenum --linenum-action=tab nvim +{line} {path}

will open the selected file in a new tab inside `Neovim <https://neovim.io/>`__
when you press :kbd:`Ctrl+G`.

Pressing :sc:`open_selected_hyperlink` will open :term:`hyperlinks`, i.e. a URL
that has been marked as such by the program running in the terminal,
for example, by ``ls --hyperlink=auto``. If :program:`ls` comes with your OS
does not support hyperlink, you may need to install `GNU Coreutils
<https://www.gnu.org/software/coreutils/>`__.

You can also :doc:`customize what actions are taken for different types of URLs
<../open_actions>`.

.. note:: If there are more hints than letters, hints will use multiple
   letters. In this case, when you press the first letter, only hints
   starting with that letter are displayed. Pressing the second letter will
   select that hint or press :kbd:`Enter` or :kbd:`Space` to select the empty
   hint.

For mouse lovers, the hints kitten also allows you to click on any matched text to
select it instead of typing the hint character.

The hints kitten is very powerful to see more detailed help on its various
options and modes of operation, see below. You can use these options to
create mappings in :file:`kitty.conf` to select various different text
snippets. See :sc:`insert_selected_path <insert_selected_path>` for examples.


Completely customizing the matching and actions of the kitten
---------------------------------------------------------------

The hints kitten supports writing simple Python scripts that can be used to
completely customize how it finds matches and what happens when a match is
selected. This allows the hints kitten to provide the user interface, while you
can provide the logic for finding matches and performing actions on them. This
is best illustrated with an example. Create the file :file:`custom-hints.py` in
the :ref:`kitty config directory <confloc>` with the following contents:

.. code-block:: python

    import re

    def mark(text, args, Mark, extra_cli_args, *a):
        # This function is responsible for finding all
        # matching text. extra_cli_args are any extra arguments
        # passed on the command line when invoking the kitten.
        # We mark all individual word for potential selection
        for idx, m in enumerate(re.finditer(r'\w+', text)):
            start, end = m.span()
            mark_text = text[start:end].replace('\n', '').replace('\0', '')
            # The empty dictionary below will be available as groupdicts
            # in handle_result() and can contain string keys and arbitrary JSON
            # serializable values.
            yield Mark(idx, start, end, mark_text, {})


    def handle_result(args, data, target_window_id, boss, extra_cli_args, *a):
        # This function is responsible for performing some
        # action on the selected text.
        # matches is a list of the selected entries and groupdicts contains
        # the arbitrary data associated with each entry in mark() above
        matches, groupdicts = [], []
        for m, g in zip(data['match'], data['groupdicts']):
            if m:
                matches.append(m), groupdicts.append(g)
        for word, match_data in zip(matches, groupdicts):
            # Lookup the word in a dictionary, the open_url function
            # will open the provided url in the system browser
            boss.open_url(f'https://www.google.com/search?q=define:{word}')

Now run kitty with::

    kitty -o 'map f1 kitten hints --customize-processing custom-hints.py'

When you press the :kbd:`F1` key you will be able to select a word to
look it up in the Google dictionary.

.. include:: ../generated/cli-kitten-hints.rst

.. note::

    To avoid having to specify the same command line options on every
    invocation, you can use the :opt:`action_alias` option in
    :file:`kitty.conf`, creating aliases that have common sets of options.
    For example::

        action_alias myhints kitten hints --alphabet qfjdkslaureitywovmcxzpq1234567890
        map f1 myhints --customize-processing custom-hints.py
```

## File: docs/kittens/hyperlinked_grep.rst
```rst
Hyperlinked grep
=================

.. only:: man

    Overview
    --------------


.. note::

   As of ripgrep versions newer that 13.0 it supports hyperlinks
   natively so you can just add the following alias in your shell rc file:
   ``alias rg="rg --hyperlink-format=kitty"`` no need to use this kitten.
   But, see below for instructions on how to customize kitty to have it open
   the hyperlinks from ripgrep in your favorite editor.

This kitten allows you to search your files using `ripgrep
<https://github.com/BurntSushi/ripgrep>`__ and open the results directly in your
favorite editor in the terminal, at the line containing the search result,
simply by clicking on the result you want.

.. versionadded:: 0.19.0

To set it up, first create :file:`~/.config/kitty/open-actions.conf` with the
following contents:

.. code:: conf

    # Open any file with a fragment in vim, fragments are generated
    # by the hyperlink-grep kitten and nothing else so far.
    protocol file
    fragment_matches [0-9]+
    action launch --type=overlay --cwd=current vim +${FRAGMENT} -- ${FILE_PATH}

    # Open text files without fragments in the editor
    protocol file
    mime text/*
    action launch --type=overlay --cwd=current -- ${EDITOR} -- ${FILE_PATH}

Now, run a search with::

    kitten hyperlinked-grep something

Hold down the :kbd:`Ctrl+Shift` keys and click on any of the result lines, to
open the file in :program:`vim` at the matching line. If you use some editor
other than :program:`vim`, you should adjust the :file:`open-actions.conf` file
accordingly. TO open links with the keyboard instead, use
:sc:`open_selected_hyperlink`.

Finally, add an alias to your shell's rc files to invoke the kitten as
:command:`hg`::

    alias hg="kitten hyperlinked-grep"


You can now run searches with::

    hg some-search-term

To learn more about kitty's powerful framework for customizing URL click
actions, see :doc:`here </open_actions>`.

By default, this kitten adds hyperlinks for several parts of ripgrep output:
the per-file header, match context lines, and match lines. You can control
which items are linked with a :code:`--kitten hyperlink` flag. For example,
:code:`--kitten hyperlink=matching_lines` will only add hyperlinks to the
match lines. :code:`--kitten hyperlink=file_headers,context_lines` will link
file headers and context lines but not match lines. :code:`--kitten
hyperlink=none` will cause the command line to be passed to directly to
:command:`rg` so no hyperlinking will be performed. :code:`--kitten hyperlink`
may be specified multiple times.

Hopefully, someday this functionality will make it into some `upstream grep
<https://github.com/BurntSushi/ripgrep/issues/665>`__ program directly removing
the need for this kitten.


.. note::
   While you can pass any of ripgrep's command line options to the kitten and
   they will be forwarded to :program:`rg`, do not use options that change the
   output formatting as the kitten works by parsing the output from ripgrep.
   The unsupported options are: :code:`--context-separator`,
   :code:`--field-context-separator`, :code:`--field-match-separator`,
   :code:`--json`, :code:`-I --no-filename`, :code:`-0 --null`,
   :code:`--null-data`, :code:`--path-separator`. If you specify options via
   configuration file, then any changes to the default output format will not be
   supported, not just the ones listed.
```

## File: docs/kittens/icat.rst
```rst
icat
========================================

.. only:: man

    Overview
    --------------


*Display images in the terminal*

The ``icat`` kitten can be used to display arbitrary images in the |kitty|
terminal. Using it is as simple as::

    kitten icat image.jpeg

It supports all image types supported by `ImageMagick
<https://www.imagemagick.org>`__. It even works over SSH. For details, see the
:doc:`kitty graphics protocol </graphics-protocol>`.

You might want to create an alias in your shell's configuration files::

   alias icat="kitten icat"

Then you can simply use ``icat image.png`` to view images.

.. note::

    `ImageMagick <https://www.imagemagick.org>`__ must be installed for the
    full range of image types. Without it only PNG/JPG/GIF/BMP/TIFF/WEBP are
    supported.

.. note::

    kitty's image display protocol may not work when used within a terminal
    multiplexer such as :program:`screen` or :program:`tmux`, depending on
    whether the multiplexer has added support for it or not.


.. program:: kitty +kitten icat


The ``icat`` kitten has various command line arguments to allow it to be used
from inside other programs to display images. In particular, :option:`--place`,
:option:`--detect-support` and :option:`--print-window-size`.

If you are trying to integrate icat into a complex program like a file manager
or editor, there are a few things to keep in mind. icat normally works by communicating
over the TTY device, it both writes to and reads from the TTY. So it is
imperative that while it is running the host program does not do any TTY I/O.
Any key presses or other input from the user on the TTY device will be
discarded. If you would instead like to use it just as a backend to generate
the escape codes for image display, you need to pass it options to tell it the
window dimensions, where to place the image in the window and the transfer mode
to use. If you do that, it will not try to communicate with the TTY device at
all. The requisite options are: :option:`--use-window-size`, :option:`--place`
and :option:`--transfer-mode`, :option:`--stdin=no`.
For example, to demonstrate usage without access to the TTY:

.. code:: sh

   zsh -c 'setsid kitten icat --stdin=no --use-window-size $COLUMNS,$LINES,3000,2000 --transfer-mode=file myimage.png'

Here, ``setsid`` ensures icat has no access to the TTY device.
The values, 3000, 2000 are made up. They are the window width and height in
pixels, to obtain which access to the TTY is needed.

To be really robust you should consider writing proper support for the
:doc:`kitty graphics protocol </graphics-protocol>` in the program instead.
Nowadays there are many libraries that have support for it.


.. include:: /generated/cli-kitten-icat.rst
```

## File: docs/kittens/notify.rst
```rst
notify
==================================================

.. only:: man

    Overview
    --------------

Show pop-up system notifications.

.. highlight:: sh

.. versionadded:: 0.36.0
   The notify kitten

The ``notify`` kitten can be used to show pop-up system notifications
from the shell. It even works over SSH. Using it is as simple as::

    kitten notify "Good morning" Hello world, it is a nice day!

To add an icon, use::

    kitten notify --icon-path /path/to/some/image.png "Good morning" Hello world, it is a nice day!
    kitten notify --icon firefox "Good morning" Hello world, it is a nice day!


To be informed when the notification is activated::

    kitten notify --wait-for-completion "Good morning" Hello world, it is a nice day!

Then, the kitten will wait till the notification is either closed or activated.
If activated, a ``0`` is printed to :file:`STDOUT`. You can press the
:kbd:`Esc` or :kbd:`Ctrl+c` keys to abort, closing the notification.

To add buttons to the notification::

    kitten notify --wait-for-completion --button One --button Two "Good morning" Hello world, it is a nice day!

.. program:: kitty +kitten notify

.. tip:: Learn about the underlying :doc:`/desktop-notifications` escape code protocol.

.. include:: /generated/cli-kitten-notify.rst
```

## File: docs/kittens/panel.rst
```rst
Draw a GPU accelerated dock panel on your desktop
====================================================================================================

.. highlight:: sh

.. only:: man

    Overview
    --------------

.. include:: ../quake-screenshots.rst

Draw the desktop wallpaper or docks and panels using arbitrary
terminal programs, For example, have `btop
<https://github.com/aristocratos/btop>`__ or `cava
<https://github.com/karlstav/cava/>`__ be your desktop wallpaper.

It is useful for showing status information or notifications on your desktop
using terminal programs instead of GUI toolkits.


The screenshot to the side shows some uses of the panel kitten to draw various
desktop components such as the background, a quick access floating terminal and
a dock panel showing system information (Linux only).

.. versionadded:: 0.42.0

   Support for macOS, see :ref:`compatibility matrix <panel_compat>` for details.
   and X11 (background and overlay).

.. versionadded:: 0.34.0

   Support for Wayland. See :ref:`below <panel_compat>` for which
   Wayland compositors work.

Using this kitten is simple, for example::

    kitten panel sh -c 'printf "\n\n\nHello, world."; sleep 5s'

This will show ``Hello, world.`` at the top edge of your screen for five
seconds. Here, the terminal program we are running is :program:`sh` with a script
to print out ``Hello, world!``. You can make the terminal program as complex as
you like, as demonstrated in the screenshots.

If you are on Wayland or macOS, you can, for instance, run::

    kitten panel --edge=background htop

to display ``htop`` as your desktop background. Remember this works in everything
but GNOME and also, in sway, you have to disable the background wallpaper as
sway renders that over the panel kitten surface.

There are projects that make use of this facility to implement generalised
panels and desktop components:

.. _panel_projects:

    * `kitty panel <https://github.com/5hubham5ingh/kitty-panel>`__
    * `pawbar <https://github.com/codelif/pawbar>`__


.. _remote_control_panel:

Controlling panels via remote control
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

You can control panels via the kitty :doc:`remote control </remote-control>` facility. Create a panel
with remote control enabled::

    kitten panel -o allow_remote_control=socket-only --lines=2 \
        --listen-on=unix:/tmp/panel kitten run-shell


Now you can control this panel using remote control, for example to show/hide
it, use::

    kitten @ --to=unix:/tmp/panel resize-os-window --action=toggle-visibility

To move the panel to the bottom of the screen and increase its height::

    kitten @ --to=unix:/tmp/panel resize-os-window --action=os-panel \
        --incremental edge=bottom lines=4

To create a new panel running the program top, in the same instance
(like creating a new OS window)::

    kitten @ --to=unix:/tmp/panel launch --type=os-panel --os-panel edge=top \
        --os-panel lines=8 top


.. include:: ../generated/cli-kitten-panel.rst


.. _quake_ss:

How the screenshots were generated
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The system statistics in the background were created using::

    kitten panel --edge=background -o background_opacity=0.2 -o background=black btop

This creates a kitty background window and inside it runs the `btop
<https://github.com/aristocratos/btop>`__ program to display the statistics.

The floating quick access window was created by running::

    kitten quick-access-terminal kitten run-shell \
       zsh -c 'printf "\e]66;s=4;Quick access kitty in Hyprland\a\n\n\n\nAlso uses kitty to draw desktop background\n"'

This starts the quick access window and inside it runs ``kitten run-shell``, which
in turn first runs ``zsh`` to print out the message and then starts the users login
shell.

The Linux dock panel was::

    wm bar

This is a custom program I wrote for my personal use. It uses kitty's kitten
infrastructure to implement the bar in a `few hundred lines of code
<https://github.com/kovidgoyal/wm/blob/master/bar/main.go>`__.
This was designed for my personal use only, but, there are :ref:`public projects implementing
general purpose panels using kitty <panel_projects>`.


.. _panel_compat:

Compatibility with various platforms
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. only:: man

   See the HTML documentation for the compatibility matrix.

.. only:: not man

    Generated with the help of the :file:`panels.py` test script.

    .. tab:: Wayland

        Below is a list of the status of various Wayland compositors. The panel kitten
        relies on the `wlr layer shell protocol
        <https://wayland.app/protocols/wlr-layer-shell-unstable-v1#compositor-support>`__,
        which is technically supported by almost all Wayland compositors, but the
        implementation in some of them is quite buggy.

        🟢 **Hyprland**
           Fully working, no known issues

        🟢 **labwc**
           Fully working, no known issues

        🟢 **niri**
           Fully working, no known issues

        🟢 **river**
           Fully working, no known issues

        🟢 **Xfce**
           Fully working, no known issues

        🟠 **KDE** (kwin)
           Mostly working, except that clicks outside background panels cause kwin to :iss:`erroneously hide the panel <8715>`. KDE uses an `undocumented mapping <https://invent.kde.org/plasma/kwin/-/blob/3dc5cee6b34792486b343098e55e7f2b90dfcd00/src/layershellv1window.cpp#L24>`__ under Wayland to set the window type from the :code:`kitten panel --app-id` flag. You might want to use :code:`--app-id=dock` so that KDE treats the window as a dock panel, and disables window appearing/disappearing animations for it.

        🟠 **Sway**
           Renders its configured background over the background window instead of
           under it. This is because it uses the wlr protocol for backgrounds itself.

        🔴 **GNOME** (mutter)
           Does not implement the wlr protocol at all, nothing works.

    .. tab:: macOS

        Mostly everything works, with the notable exception that dock panels do not
        prevent other windows from covering them. This is because Apple does not
        provide and way to do this in their APIs.

    .. tab:: X11

        Support is highly dependent on the quirks of individual window
        managers. See the matrix below:

        .. list-table:: Compatibility matrix
           :header-rows: 1
           :stub-columns: 1

           * - WM
             - Desktop
             - Dock
             - Quick
             - Notes

           * - KDE
             - 🟠
             - 🟢
             - 🟢
             - transparency does not work for :option:`--edge=background <--edge>`

           * - GNOME
             - 🟢
             - 🟢
             - 🟢
             -

           * - XFCE
             - 🟢
             - 🟢
             - 🟢
             -

           * - i3
             - 🔴
             - 🟠
             - 🔴
             - only top and bottom dock panels, without transparency

           * - xmonad
             - 🔴
             - 🔴
             - 🔴
             - doesn't support the needed NET_WM protocols
```

## File: docs/kittens/query_terminal.rst
```rst
Query terminal
=================

.. only:: man

    Overview
    --------------


This kitten is used to query |kitty| from terminal programs about version, values
of various runtime options controlling its features, etc.

The querying is done using the (*semi*) standard XTGETTCAP escape sequence
pioneered by xterm, so it works over SSH as well. The downside is that it is
slow, since it requires a roundtrip to the terminal emulator and back.

If you want to do some of the same querying in your terminal program without
depending on the kitten, you can do so, by processing the same escape codes.
Search `this page <https://invisible-island.net/xterm/ctlseqs/ctlseqs.html>`__
for *XTGETTCAP* to see the syntax for the escape code. The kitty specific keys
are all documented below, when sent via escape code they must be prefixed with
``kitty-query-``.


.. include:: ../generated/cli-kitten-query_terminal.rst
```

## File: docs/kittens/quick-access-terminal.rst
```rst
.. _quake:

Make a Quake like quick access terminal
====================================================================================================

.. highlight:: sh

.. only:: man

    Overview
    --------------


.. include:: ../quake-screenshots.rst

.. versionadded:: 0.42.0
   See :ref:`here for what platforms it works on <panel_compat>`.

This kitten can be used to make a quick access terminal, that appears and
disappears at a key press. To do so use the following command:

.. code-block:: sh

    kitten quick-access-terminal

Run this command in a terminal, and a quick access kitty window will show up at
the top of your screen. Run it again, and the window will be hidden.

To make the terminal appear and disappear at a key press:

.. |macOs| replace:: :guilabel:`System Preferences->Keyboard->Keyboard Shortcuts->Services->General`

.. only:: not man

    .. tab:: Linux

        Simply bind the above command to some key press in your window manager or desktop
        environment settings and then you have a quick access terminal at a single key press.

    .. tab:: macOS

        In kitty, run the above command to show the quick access window, then close
        it by running the command again or pressing :kbd:`ctrl+d`. Now go to |macOS| and set a shortcut for
        the :guilabel:`Quick access to kitty` entry.

.. only:: man

    In Linux, simply assign the above command to a global shortcut in your
    window manager. In macOS, go to |macOS| and set a shortcut
    for the :guilabel:`Quick access to kitty` entry.

Configuration
------------------------

You can configure the appearance and behavior of the quick access window
by creating a :file:`quick-access-terminal.conf` file in your
:ref:`kitty config folder <confloc>`. In particular, you can use the
:opt:`kitty_conf <kitten-quick_access_terminal.kitty_conf>` option to change
various kitty settings, just for the quick access window.

.. note::

   This kitten uses the :doc:`panel kitten </kittens/panel>` under the
   hood. You can use the :ref:`techniques described there <remote_control_panel>`
   for remote controlling the quick access window, remember to add
   ``kitty_override allow_remote_control=socket-only`` and ``kitty_override
   listen_on=unix:/tmp/whatever`` to
   :file:`quick-access-terminal.conf`.

See below for the supported configuration directives:


.. include:: /generated/conf-kitten-quick_access_terminal.rst


.. include:: /generated/cli-kitten-quick_access_terminal.rst


Sample quick-access-terminal.conf
---------------------------------------

You can download a sample :file:`quick-access-terminal.conf` file with all default settings and
comments describing each setting by clicking: :download:`sample quick-access-terminal.conf
</generated/conf/quick_access_terminal.conf>`.
```

## File: docs/kittens/remote_file.rst
```rst
Remote files
==============

.. only:: man

    Overview
    --------------


|kitty| has the ability to easily *Edit*, *Open* or *Download* files from a
computer into which you are SSHed. In your SSH session run::

    ls --hyperlink=auto

Then hold down :kbd:`Ctrl+Shift` and click the name of the file.

.. figure:: ../screenshots/remote_file.png
    :alt: Remote file actions
    :align: center
    :width: 100%

    Remote file actions

|kitty| will ask you what you want to do with the remote file. You can choose
to *Edit* it in which case kitty will download it and open it locally in your
:envvar:`EDITOR`. As you make changes to the file, they are automatically
transferred to the remote computer. Note that this happens without needing
to install *any* special software on the server, beyond :program:`ls` that
supports hyperlinks.

.. seealso:: See the :ref:`edit-in-kitty <edit_file>` command

.. seealso:: See the :doc:`transfer` kitten

.. versionadded:: 0.19.0

.. note::
   For best results, use this kitten with the :doc:`ssh kitten <./ssh>`.
   Otherwise, nested SSH sessions are not supported. The kitten will always try to copy
   remote files from the first SSH host. This is because, without the ssh
   kitten, there is no way for
   |kitty| to detect and follow a nested SSH session robustly. Use the
   :doc:`transfer` kitten for such situations.

.. note::
   If you have not setup automatic password-less SSH access, and are not using
   the ssh kitten, then, when editing
   starts you will be asked to enter your password just once, thereafter the SSH
   connection will be re-used.

Similarly, you can choose to save the file to the local computer or download
and open it in its default file handler.
```

## File: docs/kittens/ssh.rst
```rst
Truly convenient SSH
=========================================

.. only:: man

   Overview
   ----------------

* Automatic :ref:`shell_integration` on remote hosts

* Easily :ref:`clone local shell/editor config <real_world_ssh_kitten_config>` on remote hosts

* Automatic :opt:`re-use of existing connections <kitten-ssh.share_connections>` to avoid connection setup latency

* Make the kitten binary available in the remote host :opt:`on demand <kitten-ssh.remote_kitty>`

* Easily :opt:`change terminal colors <kitten-ssh.color_scheme>` when connecting to remote hosts

* Automatically :opt:`forward the kitty remote control socket <kitten-ssh.forward_remote_control>` to configured hosts

.. versionadded:: 0.25.0
   Automatic shell integration, file transfer and reuse of connections

.. versionadded:: 0.30.0
   Automatic forwarding of remote control sockets

The ssh kitten allows you to login easily to remote hosts, and automatically
setup the environment there to be as comfortable as your local shell. You can
specify environment variables to set on the remote host and files to copy there,
making your remote experience just like your local shell. Additionally, it
automatically sets up :ref:`shell_integration` on the remote host and copies the
kitty terminfo database there.

The ssh kitten is a thin wrapper around the traditional `ssh <https://man.openbsd.org/ssh>`__
command line program and supports all the same options and arguments and configuration.
In interactive usage scenarios it is a drop in replacement for :program:`ssh`.
To try it out, simply run:

.. code-block:: sh

    kitten ssh some-hostname-to-connect-to

You should end up at a shell prompt on the remote host, with shell integration
enabled. If you like it you can add an alias to it in your shell's rc files:

.. code-block:: sh

    alias s="kitten ssh"

So now you can just type ``s hostname`` to connect.

If you define a mapping in :file:`kitty.conf` such as::

    map f1 new_window_with_cwd

Then, pressing :kbd:`F1` will open a new window automatically logged into the
same host using the ssh kitten, at the same directory.

The ssh kitten can be configured using the :file:`~/.config/kitty/ssh.conf` file
where you can specify environment variables to set on the remote host and files
to copy from the local to the remote host. Let's see a quick example:

.. code-block:: conf

   # Copy the files and directories needed to setup some common tools
   copy .zshrc .vimrc .vim
   # Setup some environment variables
   env SOME_VAR=x
   # COPIED_VAR will have the same value on the remote host as it does locally
   env COPIED_VAR=_kitty_copy_env_var_

   # Create some per hostname settings
   hostname someserver-*
   copy env-files
   env SOMETHING=else

   hostname someuser@somehost
   copy --dest=foo/bar some-file
   copy --glob some/files.*


See below for full details on the syntax and options of :file:`ssh.conf`.
Additionally, you can pass config options on the command line:

.. code-block:: sh

   kitten ssh --kitten interpreter=python servername

The :code:`--kitten` argument can be specified multiple times, with directives
from :file:`ssh.conf`. These override the final options used for the matched host, as if they
had been appended to the end of the matching section for that host in
:file:`ssh.conf`. They apply only to the host being SSHed to by this invocation,
so any :opt:`hostname <kitten-ssh.hostname>` directives are ignored.

.. warning::

   Due to limitations in the design of SSH, any typing you do before the
   shell prompt appears may be lost. So ideally don't start typing till you see
   the shell prompt. 😇


.. _real_world_ssh_kitten_config:

A real world example
----------------------

Suppose you often SSH into a production server, and you would like to setup
your shell and editor there using your custom settings. However, other people
could SSH in as well and you don't want to clobber their settings. Here is how
this could be achieved using the ssh kitten with :program:`zsh` and
:program:`vim` as the shell and editor, respectively:

.. code-block:: conf

   # Have these settings apply to servers in my organization
   hostname myserver-*

   # Setup zsh to read its files from my-conf/zsh
   env ZDOTDIR=$HOME/my-conf/zsh
   copy --dest my-conf/zsh/.zshrc .zshrc
   copy --dest my-conf/zsh/.zshenv .zshenv
   # If you use other zsh init files add them in a similar manner

   # Setup vim to read its config from my-conf/vim
   env VIMINIT=$HOME/my-conf/vim/vimrc
   env VIMRUNTIME=$HOME/my-conf/vim
   copy --dest my-conf/vim .vim
   copy --dest my-conf/vim/vimrc .vimrc


How it works
----------------

The ssh kitten works by having SSH transmit and execute a POSIX sh (or
:opt:`optionally <kitten-ssh.interpreter>` Python) bootstrap script on the
remote host using an :opt:`interpreter <kitten-ssh.interpreter>`. This script
reads setup data over the TTY device, which kitty sends as a Base64 encoded
compressed tarball. The script extracts it and places the :opt:`files <kitten-ssh.copy>`
and sets the :opt:`environment variables <kitten-ssh.env>` before finally
launching the :opt:`login shell <kitten-ssh.login_shell>` with :opt:`shell
integration <kitten-ssh.shell_integration>` enabled. The data is requested by
the kitten over the TTY with a random one time password. kitty reads the request
and if the password matches a password pre-stored in shared memory on the
localhost by the kitten, the transmission is allowed. If your local
`OpenSSH <https://www.openssh.com/>`__ version is >= 8.4 then the data is
transmitted instantly without any roundtrip delay.

.. note::

   When connecting to BSD hosts, it is possible the bootstrap script will fail
   or run slowly, because the default shells are crippled in various ways.
   Your best bet is to install Python on the remote, make sure the login shell
   is something POSIX sh compliant, and use :code:`python` as the
   :opt:`interpreter <kitten-ssh.interpreter>` in :file:`ssh.conf`.


.. note::

   This may or may not work when using terminal multiplexers, depending on
   whether they passthrough the escape codes and if the values of the
   environment variables :envvar:`KITTY_PID` and :envvar:`KITTY_WINDOW_ID` are
   correct in the current session (they can be wrong when connecting to a tmux
   session running in a different window) and the ssh kitten is run in the
   currently active multiplexer window.

.. include:: /generated/conf-kitten-ssh.rst


.. _ssh_copy_command:

The copy command
--------------------

.. include:: /generated/ssh-copy.rst


.. _manual_terminfo_copy:

Copying terminfo files manually
-------------------------------------

Sometimes, the ssh kitten can fail, or maybe you dont like to use it. In such
cases, the terminfo files can be copied over manually to a server with the
following one liner::

    infocmp -a xterm-kitty | ssh myserver tic -x -o \~/.terminfo /dev/stdin

If you are behind a proxy (like Balabit) that prevents this, or you are SSHing
into macOS where the :program:`tic` does not support reading from :file:`STDIN`,
you must redirect the first command to a file, copy that to the server and run :program:`tic`
manually. If you connect to a server, embedded, or Android system that doesn't
have :program:`tic`, copy over your local file terminfo to the other system as
:file:`~/.terminfo/x/xterm-kitty`.

If the server is running a relatively modern Linux distribution and you have
root access to it, you could simply install the ``kitty-terminfo`` package on
the server to make the terminfo files available.

Really, the correct solution for this is to convince the OpenSSH maintainers to
have :program:`ssh` do this automatically, if possible, when connecting to a
server, so that all terminals work transparently.

If the server is running FreeBSD, or another system that relies on termcap
rather than terminfo, you will need to convert the terminfo file on your local
machine by running (on local machine with |kitty|)::

    infocmp -CrT0 xterm-kitty

The output of this command is the termcap description, which should be appended
to :file:`/usr/share/misc/termcap` on the remote server. Then run the following
command to apply your change (on the server)::

    cap_mkdb /usr/share/misc/termcap
```

## File: docs/kittens/themes.rst
```rst
Changing kitty colors
========================

.. only:: man

    Overview
    --------------


The themes kitten allows you to easily change color themes, from a collection of
over three hundred pre-built themes available at `kitty-themes
<https://github.com/kovidgoyal/kitty-themes>`_. To use it, simply run::

    kitten themes


.. image:: ../screenshots/themes.png
   :alt: The themes kitten in action
   :width: 600

The kitten allows you to pick a theme, with live previews of the colors. You can
choose between light and dark themes and search by theme name by just typing a
few characters from the name.

The kitten maintains a list of recently used themes to allow quick switching.

If you want to restore the colors to default, you can do so by choosing the
``Default`` theme.

.. versionadded:: 0.23.0
   The themes kitten


How it works
----------------

A theme in kitty is just a :file:`.conf` file containing kitty settings.
When you select a theme, the kitten simply copies the :file:`.conf` file
to :file:`~/.config/kitty/current-theme.conf` and adds an include for
:file:`current-theme.conf` to :file:`kitty.conf`. It also comments out any
existing color settings in :file:`kitty.conf` so they do not interfere.

Once that's done, the kitten sends kitty a signal to make it reload its config.


.. note::

   If you want to have some color settings in your :file:`kitty.conf` that the
   theme kitten does not override, move them into a separate conf file and
   ``include`` it into kitty.conf. The include should be placed after the
   inclusion of :file:`current-theme.conf` so that the settings in it override
   conflicting settings from :file:`current-theme.conf`.


.. _auto_color_scheme:

Change color themes automatically when the OS switches between light and dark
--------------------------------------------------------------------------------

.. versionadded:: 0.38.0

You can have kitty automatically change its color theme when the OS switches
between dark, light and no-preference modes. In order to do this, run the theme
kitten as normal and at the final screen select the option to save your chosen
theme as either light, dark, or no-preference. Repeat until you have chosen
a theme for each of the three modes. Then, once you restart kitty, it will
automatically use your chosen themes depending on the OS color scheme.

This works by creating three files: :file:`dark-theme.auto.conf`,
:file:`light-theme.auto.conf` and :file:`no-preference-theme.auto.conf` in the
kitty config directory. When these files exist, kitty queries the OS for its color scheme
and uses the appropriate file. Note that the colors in these files override all other
colors, and also all background image settings,
even those specified using the :option:`kitty --override` command line flag.
kitty will also automatically change colors when the OS color scheme changes,
for example, during night/day transitions.

When using these colors, you can still dynamically change colors, but the next
time the OS changes its color mode, any dynamic changes will be overridden.


.. note::

   On the GNOME desktop, the desktop reports the color preference as no-preference
   when the "Dark style" is not enabled. So use :file:`no-preference-theme.auto.conf` to
   select colors for light mode on GNOME. You can manually enable light style
   with ``gsettings set org.gnome.desktop.interface color-scheme prefer-light``
   in which case GNOME will report the color scheme as light and kitty will use
   :file:`light-theme.auto.conf`.


Using your own themes
-----------------------

You can also create your own themes as :file:`.conf` files. Put them in the
:file:`themes` sub-directory of the :ref:`kitty config directory <confloc>`,
usually, :file:`~/.config/kitty/themes`. The kitten will automatically add them
to the list of themes. You can use this to modify the builtin themes, by giving
the conf file the name :file:`Some theme name.conf` to override the builtin
theme of that name. Here, ``Some theme name`` is the actual builtin theme name, not
its file name. Note that after doing so you have to run the kitten and
choose that theme once for your changes to be applied.


Contributing new themes
-------------------------

If you wish to contribute a new theme to the kitty theme repository, start by
going to the `kitty-themes <https://github.com/kovidgoyal/kitty-themes>`__
repository. `Fork it
<https://docs.github.com/en/get-started/quickstart/fork-a-repo>`__, and use the
file :download:`template.conf
<https://github.com/kovidgoyal/kitty-themes/raw/master/template.conf>` as a
template when creating your theme. Once you are satisfied with how it looks,
`submit a pull request
<https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request>`__
to have your theme merged into the `kitty-themes
<https://github.com/kovidgoyal/kitty-themes>`__ repository, which will make it
available in this kitten automatically.


Changing the theme non-interactively
---------------------------------------

You can specify the theme name as an argument when invoking the kitten to have
it change to that theme instantly. For example::

    kitten themes --reload-in=all Dimmed Monokai

Will change the theme to ``Dimmed Monokai`` in all running kitty instances. See
below for more details on non-interactive operation.

.. include:: ../generated/cli-kitten-themes.rst
```

## File: docs/kittens/transfer.rst
```rst
Transfer files
================

.. only:: man

    Overview
    --------------


.. versionadded:: 0.30.0

.. _rsync: https://en.wikipedia.org/wiki/Rsync

Transfer files to and from remote computers over the ``TTY`` device itself.
This means that file transfer works over nested SSH sessions, serial links,
etc. Anywhere you have a terminal device, you can transfer files.

.. image:: ../screenshots/transfer.png
   :alt: The transfer kitten at work

This kitten supports transferring entire directory trees, preserving soft and
hard links, file permissions, times, etc. It even supports the rsync_ protocol
to transfer only changes to large files.

.. seealso:: See the :doc:`remote_file` kitten

Basic usage
---------------

Simply ssh into a remote computer using the :doc:`ssh kitten </kittens/ssh>` and run the this kitten
(which the ssh kitten makes available for you on the remote computer
automatically). Some illustrative examples are below. To copy a file from a
remote computer::

    <local computer>  $ kitten ssh my-remote-computer
    <remote computer> $ kitten transfer some-file /path/on/local/computer

This, will copy :file:`some-file` from the computer into which you have SSHed
to your local computer at :file:`/path/on/local/computer`. kitty will ask you
for confirmation before allowing the transfer, so that the file transfer
protocol cannot be abused to read/write files on your computer.

To copy a file from your local computer to the remote computer::

    <local computer>  $ kitten ssh my-remote-computer
    <remote computer> $ kitten transfer --direction=upload /path/on/local/computer remote-file

For more detailed usage examples, see the command line interface section below.

.. note::
   If you dont want to use the ssh kitten, you can install the kitten binary on
   the remote machine yourself, it is a standalone, statically compiled binary
   available from the `kitty releases page
   <https://github.com/kovidgoyal/kitty/releases>`__. Or you can write your own
   script/program to use the underlying :doc:`file transfer protocol
   </file-transfer-protocol>`.

Avoiding the confirmation prompt
------------------------------------

Normally, when you start a file transfer kitty will prompt you for confirmation.
This is to ensure that hostile programs running on a remote machine cannot
read/write files on your computer without your permission. If the remote machine
is trusted, then you can disable the confirmation prompt by:

#. Setting the :opt:`file_transfer_confirmation_bypass` option to some password.

#. When invoking the kitten use the :option:`--permissions-bypass
   <kitty +kitten transfer --permissions-bypass>` to supply the password you set
   in step one.

.. warning:: Using a password to bypass confirmation means any software running
   on the remote machine could potentially learn that password and use it to
   gain full access to your computer.


Delta transfers
-----------------------------------

This kitten has the ability to use the rsync_ protocol to only transfer the
differences between files. To turn it on use the :option:`--transmit-deltas
<kitty +kitten transfer --transmit-deltas>` option. Note that this will
actually be slower when transferring small files or on a very fast network, because
of round trip overhead, so use with care.


.. include:: ../generated/cli-kitten-transfer.rst
```

## File: docs/kittens/unicode_input.rst
```rst
Unicode input
================

.. only:: man

    Overview
    --------------


You can input Unicode characters by name, hex code, recently used and even an
editable favorites list. Press :sc:`input_unicode_character` to start the
unicode input kitten, shown below.

.. figure:: ../screenshots/unicode.png
    :alt: A screenshot of the unicode input kitten
    :align: center
    :width: 100%

    A screenshot of the unicode input kitten

In :guilabel:`Code` mode, you enter a Unicode character by typing in the hex
code for the character and pressing :kbd:`Enter`. For example, type in ``2716``
and press :kbd:`Enter` to get ``✖``. You can also choose a character from the
list of recently used characters by typing a leading period ``.`` and then the
two character index and pressing :kbd:`Enter`.
The :kbd:`Up` and :kbd:`Down` arrow keys can be used to choose the previous and
next Unicode symbol respectively.

In :guilabel:`Name` mode you instead type words from the character name and use
the :kbd:`ArrowKeys` / :kbd:`Tab` to select the character from the displayed
matches. You can also type a space followed by a period and the index for the
match if you don't like to use arrow keys.

You can switch between modes using either the keys :kbd:`F1` ... :kbd:`F4` or
:kbd:`Ctrl+1` ... :kbd:`Ctrl+4` or by pressing :kbd:`Ctrl+[` and :kbd:`Ctrl+]`
or by pressing :kbd:`Ctrl+Tab` and :kbd:`Ctrl+Shift+Tab`.


.. include:: ../generated/cli-kitten-unicode_input.rst
```

## File: docs/actions.rst
```rst
Mappable actions
-----------------------

.. highlight:: conf

The actions described below can be mapped to any key press or mouse action
using the ``map`` and ``mouse_map`` directives in :file:`kitty.conf`. For
configuration examples, see the default shortcut links for each action.
To read about keyboard mapping in more detail, see :doc:`mapping`.

.. include:: /generated/actions.rst
```

## File: docs/basic.rst
```rst
Tabs and Windows
-------------------

|kitty| is capable of running multiple programs organized into tabs and windows.
The top level of organization is the :term:`OS window <os_window>`. Each OS
window consists of one or more :term:`tabs <tab>`. Each tab consists of one or more
:term:`kitty windows <window>`. The kitty windows can be arranged in multiple
different :term:`layouts <layout>`, like windows are organized in a tiling
window manager. The keyboard controls (which are :ref:`all customizable
<conf-kitty-shortcuts>`) for tabs and windows are:

Scrolling
~~~~~~~~~~~~~~

=========================   =======================
Action                      Shortcut
=========================   =======================
Line up                     :sc:`scroll_line_up` (also :kbd:`⌥+⌘+⇞` and :kbd:`⌘+↑` on macOS)
Line down                   :sc:`scroll_line_down` (also :kbd:`⌥+⌘+⇟` and :kbd:`⌘+↓` on macOS)
Page up                     :sc:`scroll_page_up` (also :kbd:`⌘+⇞` on macOS)
Page down                   :sc:`scroll_page_down` (also :kbd:`⌘+⇟` on macOS)
Top                         :sc:`scroll_home` (also :kbd:`⌘+↖` on macOS)
Bottom                      :sc:`scroll_end` (also :kbd:`⌘+↘` on macOS)
Previous shell prompt       :sc:`scroll_to_previous_prompt` (see :ref:`shell_integration`)
Next shell prompt           :sc:`scroll_to_next_prompt` (see :ref:`shell_integration`)
Browse scrollback in less   :sc:`show_scrollback`
Browse last cmd output      :sc:`show_last_command_output` (see :ref:`shell_integration`)
Search scrollback in less   :sc:`search_scrollback` (also :kbd:`⌘+F` on macOS)
=========================   =======================

The scroll actions only take effect when the terminal is in the main screen.
When the alternate screen is active (for example when using a full screen
program like an editor) the key events are instead passed to program running in the
terminal.

Tabs
~~~~~~~~~~~

========================    =======================
Action                      Shortcut
========================    =======================
New tab                     :sc:`new_tab` (also :kbd:`⌘+t` on macOS)
Close tab                   :sc:`close_tab` (also :kbd:`⌘+w` on macOS)
Next tab                    :sc:`next_tab` (also :kbd:`⇧+⌃+⇥` and :kbd:`⇧+⌘+]` on macOS)
Previous tab                :sc:`previous_tab` (also :kbd:`⇧+⌃+⇥` and :kbd:`⇧+⌘+[` on macOS)
Next layout                 :sc:`next_layout`
Move tab forward            :sc:`move_tab_forward`
Move tab backward           :sc:`move_tab_backward`
Set tab title               :sc:`set_tab_title` (also :kbd:`⇧+⌘+i` on macOS)
========================    =======================


Windows
~~~~~~~~~~~~~~~~~~

========================    =======================
Action                      Shortcut
========================    =======================
New window                  :sc:`new_window` (also :kbd:`⌘+↩` on macOS)
New OS window               :sc:`new_os_window` (also :kbd:`⌘+n` on macOS)
Close window                :sc:`close_window` (also :kbd:`⇧+⌘+d` on macOS)
Resize window               :sc:`start_resizing_window` (also :kbd:`⌘+r` on macOS)
Next window                 :sc:`next_window`
Previous window             :sc:`previous_window`
Move window forward         :sc:`move_window_forward`
Move window backward        :sc:`move_window_backward`
Move window to top          :sc:`move_window_to_top`
Visually focus window       :sc:`focus_visible_window`
Visually swap window        :sc:`swap_with_window`
Focus specific window       :sc:`first_window`, :sc:`second_window` ... :sc:`tenth_window`
                            (also :kbd:`⌘+1`, :kbd:`⌘+2` ... :kbd:`⌘+9` on macOS)
                            (clockwise from the top-left)
========================    =======================

Additionally, you can define shortcuts in :file:`kitty.conf` to focus
neighboring windows and move windows around (similar to window movement in
:program:`vim`)::

   map ctrl+left neighboring_window left
   map shift+left move_window right
   map ctrl+down neighboring_window down
   map shift+down move_window up
   ...

You can also define a shortcut to switch to the previously active window::

   map ctrl+p nth_window -1

:ac:`nth_window` will focus the nth window for positive numbers (starting from
zero) and the previously active windows for negative numbers.

To switch to the nth OS window, you can define :ac:`nth_os_window`. Only
positive numbers are accepted, starting from one.

.. _detach_window:

You can define shortcuts to detach the current window and move it to another tab
or another OS window::

    # moves the window into a new OS window
    map ctrl+f2 detach_window
    # moves the window into a new tab
    map ctrl+f3 detach_window new-tab
    # moves the window into the previously active tab
    map ctrl+f3 detach_window tab-prev
    # moves the window into the tab at the left of the active tab
    map ctrl+f3 detach_window tab-left
    # moves the window into a new tab created to the left of the active tab
    map ctrl+f3 detach_window new-tab-left
    # asks which tab to move the window into
    map ctrl+f4 detach_window ask

Similarly, you can detach the current tab, with::

    # moves the tab into a new OS window
    map ctrl+f2 detach_tab
    # asks which OS Window to move the tab into
    map ctrl+f4 detach_tab ask

Finally, you can define a shortcut to close all windows in a tab other than the
currently active window::

    map f9 close_other_windows_in_tab


Other keyboard shortcuts
----------------------------------

The full list of actions that can be mapped to key presses is available
:doc:`here </actions>`. To learn how to do more sophisticated keyboard
mappings, such as modal mappings, per application mappings, etc. see
:doc:`mapping`.

==================================  =======================
Action                              Shortcut
==================================  =======================
Show this help                      :sc:`show_kitty_doc`
Copy to clipboard                   :sc:`copy_to_clipboard` (also :kbd:`⌘+c` on macOS)
Paste from clipboard                :sc:`paste_from_clipboard` (also :kbd:`⌘+v` on macOS)
Paste from selection                :sc:`paste_from_selection`
Pass selection to program           :sc:`pass_selection_to_program`
Increase font size                  :sc:`increase_font_size` (also :kbd:`⌘++` on macOS)
Decrease font size                  :sc:`decrease_font_size` (also :kbd:`⌘+-` on macOS)
Restore font size                   :sc:`reset_font_size` (also :kbd:`⌘+0` on macOS)
Toggle fullscreen                   :sc:`toggle_fullscreen` (also :kbd:`⌃+⌘+f` on macOS)
Toggle maximized                    :sc:`toggle_maximized`
Input Unicode character             :sc:`input_unicode_character` (also :kbd:`⌃+⌘+space` on macOS)
Open URL in web browser             :sc:`open_url`
Reset the terminal                  :sc:`reset_terminal` (also :kbd:`⌥+⌘+r` on macOS)
Edit :file:`kitty.conf`             :sc:`edit_config_file` (also :kbd:`⌘+,` on macOS)
Reload :file:`kitty.conf`           :sc:`reload_config_file` (also :kbd:`⌃+⌘+,` on macOS)
Debug :file:`kitty.conf`            :sc:`debug_config` (also :kbd:`⌥+⌘+,` on macOS)
Open a |kitty| shell                :sc:`kitty_shell`
Increase background opacity         :sc:`increase_background_opacity`
Decrease background opacity         :sc:`decrease_background_opacity`
Full background opacity             :sc:`full_background_opacity`
Reset background opacity            :sc:`reset_background_opacity`
==================================  =======================
```

## File: docs/binary.rst
```rst
Install kitty
========================

Binary install
----------------

.. highlight:: sh

You can install pre-built binaries of |kitty| if you are on macOS or Linux using
the following simple command:

.. code-block:: sh

    _kitty_install_cmd


The binaries will be installed in the standard location for your OS,
:file:`/Applications/kitty.app` on macOS and :file:`~/.local/kitty.app` on
Linux. The installer only touches files in that directory. To update kitty,
simply re-run the command.

.. warning::
   **Do not** copy the kitty binary out of the installation folder. If you want
   to add it to your :envvar:`PATH`, create a symlink in :file:`~/.local/bin` or
   :file:`/usr/bin` or wherever. You should create a symlink for the :file:`kitten`
   binary as well. Whichever folder you choose to create the symlink in should
   be in the **systemwide** PATH, a folder added to the PATH in your shell rc
   files will not work when running kitty from your desktop environment.


Manually installing
---------------------

If something goes wrong or you simply do not want to run the installer, you can
manually download and install |kitty| from the `GitHub releases page
<https://github.com/kovidgoyal/kitty/releases>`__. If you are on macOS, download
the :file:`.dmg` and install as normal. If you are on Linux, download the
tarball and extract it into a directory. The |kitty| executable will be in the
:file:`bin` sub-directory.


Desktop integration on Linux
--------------------------------

If you want the kitty icon to appear in the taskbar and an entry for it to be
present in the menus, you will need to install the :file:`kitty.desktop` file.
The details of the following procedure may need to be adjusted for your
particular desktop, but it should work for most major desktop environments.

.. code-block:: sh

    # Create symbolic links to add kitty and kitten to PATH (assuming ~/.local/bin is in
    # your system-wide PATH)
    ln -sf ~/.local/kitty.app/bin/kitty ~/.local/kitty.app/bin/kitten ~/.local/bin/
    # Place the kitty.desktop file somewhere it can be found by the OS
    cp ~/.local/kitty.app/share/applications/kitty.desktop ~/.local/share/applications/
    # If you want to open text files and images in kitty via your file manager also add the kitty-open.desktop file
    cp ~/.local/kitty.app/share/applications/kitty-open.desktop ~/.local/share/applications/
    # Update the paths to the kitty and its icon in the kitty desktop file(s)
    sed -i "s|Icon=kitty|Icon=$(readlink -f ~)/.local/kitty.app/share/icons/hicolor/256x256/apps/kitty.png|g" ~/.local/share/applications/kitty*.desktop
    sed -i "s|Exec=kitty|Exec=$(readlink -f ~)/.local/kitty.app/bin/kitty|g" ~/.local/share/applications/kitty*.desktop
    # Make xdg-terminal-exec (and hence desktop environments that support it use kitty)
    echo 'kitty.desktop' > ~/.config/xdg-terminals.list

.. note::
    In :file:`kitty-open.desktop`, kitty is registered to handle some supported
    MIME types. This will cause kitty to take precedence on some systems where
    the default apps are not explicitly set. For example, if you expect to use
    other GUI file managers to open dir paths when using commands such as
    :program:`xdg-open`, you should configure the default opener for the MIME
    type ``inode/directory``::

        xdg-mime default org.kde.dolphin.desktop inode/directory

.. note::
    If you use the venerable `stow <https://www.gnu.org/software/stow/>`__
    command to manage your manual installations, the following takes care of the
    above for you (use with :code:`dest=~/.local/stow`)::

        cd ~/.local/stow
        stow -v kitty.app


Customizing the installation
--------------------------------

.. _nightly:

* You can install the latest nightly kitty build with ``installer``:

  .. code-block:: sh

     _kitty_install_cmd \
         installer=nightly

  If you want to install it in parallel to the released kitty specify a
  different install locations with ``dest``:

  .. code-block:: sh

     _kitty_install_cmd \
         installer=nightly dest=/some/other/location

* You can specify a specific version to install, with:

  .. code-block:: sh

     _kitty_install_cmd \
         installer=version-0.35.2

* You can tell the installer not to launch |kitty| after installing it with
  ``launch=n``:

  .. code-block:: sh

     _kitty_install_cmd \
         launch=n

* You can use a previously downloaded dmg/tarball, with ``installer``:

  .. code-block:: sh

     _kitty_install_cmd \
         installer=/path/to/dmg or tarball


Uninstalling
----------------

All the installer does is copy the kitty files into the install directory. To
uninstall, simply delete that directory.


Building from source
------------------------

|kitty| is easy to build from source, follow the :doc:`instructions <build>`.
```

## File: docs/build.rst
```rst
Build from source
==================

.. image:: https://github.com/kovidgoyal/kitty/workflows/CI/badge.svg
  :alt: Build status
  :target: https://github.com/kovidgoyal/kitty/actions?query=workflow%3ACI

.. note::
   If you just want to test the latest changes to kitty, you don't need to build
   from source. Instead install the :ref:`latest nightly build <nightly>`.

.. highlight:: sh

|kitty| is designed to run from source, for easy hack-ability. All you need to
get started is a C compiler and the `go compiler
<https://go.dev/doc/install>`__ (on Linux, the :ref:`X11 development libraries <x11-dev-libs>` as well).
After installing those, run the following commands::

    git clone https://github.com/kovidgoyal/kitty.git && cd kitty
    ./dev.sh build

That's it, kitty will be built from source, magically. You can run it as
:file:`kitty/launcher/kitty`.

This works, because the :code:`./dev.sh build` command downloads all the major
dependencies of kitty as pre-built binaries for your platform and builds kitty
to use these rather than system libraries. The few required system libraries
are X11 and DBUS on Linux.

If you make changes to kitty code, simply re-run :code:`./dev.sh build`
to build kitty with your changes.

.. note::
   If you plan to run kitty from source long-term, there are a couple of
   caveats to be aware of. You should occasionally run ``./dev.sh deps``
   to have the dependencies re-downloaded as they are updated periodically.
   Also, the built kitty executable assumes it will find source in whatever
   directory you first ran :code:`./dev.sh build` in. If you move/rename the
   directory, run :code:`make clean && ./dev.sh build`. You should also create
   symlinks to the :file:`kitty` and :file:`kitten` binaries from somewhere
   in your PATH so that they can be conveniently launched.

.. note::
   On macOS, you can use :file:`kitty/launcher/kitty.app` to run kitty as well,
   but note that this is an unsigned kitty.app so some functionality such as
   notifications will not work as Apple disallows this.  If you need this
   functionality, you can try signing the built :file:`kitty.app` with a self
   signed certificate, see for example, `here
   <https://stackoverflow.com/questions/27474751/how-can-i-codesign-an-app-without-being-in-the-mac-developer-program/27474942>`__.

Building in debug mode
^^^^^^^^^^^^^^^^^^^^^^^^^^

The following will build with debug symbols::

    ./dev.sh build --debug

To build with sanitizers and debug symbols::

    ./dev.sh build --debug --sanitize

For more help on the various options supported by the build script::

    ./dev.sh build -h


Building the documentation
-------------------------------------

To have the kitty documentation available locally, run::

    ./dev.sh deps -for-docs && ./dev.sh docs

To develop the docs, with live reloading, use::

    ./dev.sh deps -for-docs && ./dev.sh docs -live-reload

Dependencies
----------------

These dependencies are needed when building against system libraries only.

Run-time dependencies:

* ``python`` >= 3.8
* ``harfbuzz`` >= 2.2.0
* ``zlib``
* ``libpng``
* ``liblcms2``
* ``libxxhash``
* ``openssl``
* ``pixman`` (not needed on macOS)
* ``cairo`` (not needed on macOS)
* ``freetype`` (not needed on macOS)
* ``fontconfig`` (not needed on macOS)
* ``libcanberra`` (not needed on macOS)
* ``libsystemd`` (optional, not needed on non systemd systems)
* ``ImageMagick`` (optional, needed to display uncommon image formats in the terminal)


Build-time dependencies:

* ``gcc`` or ``clang``
* ``simde``
* ``go`` >= _build_go_version (see :file:`go.mod` for go packages used during building)
* ``pkg-config``
* Symbols NERD Font Mono either installed system-wide or placed in :file:`fonts/SymbolsNerdFontMono-Regular.ttf`
* For building on Linux in addition to the above dependencies you might also
  need to install the following packages, if they are not already installed by
  your distro:

  - ``liblcms2-dev``
  - ``libfontconfig-dev``
  - ``libssl-dev``
  - ``libpython3-dev``
  - ``libxxhash-dev``
  - ``libsimde-dev``
  - ``libcairo2-dev``

  .. _x11-dev-libs:

  Also, the X11 development libraries:

  - ``libdbus-1-dev``
  - ``libxcursor-dev``
  - ``libxrandr-dev``
  - ``libxi-dev``
  - ``libxinerama-dev``
  - ``libgl1-mesa-dev``
  - ``libxkbcommon-x11-dev``
  - ``libfontconfig-dev``
  - ``libx11-xcb-dev``



Build and run from source with Nix
-------------------------------------------

On NixOS or any other Linux or macOS system with the Nix package manager
installed, execute `nix-shell
<https://nixos.org/guides/nix-pills/developing-with-nix-shell.html>`__ to create
the correct environment to build kitty or use ``nix-shell --pure`` instead to
eliminate most of the influence of the outside system, e.g. globally installed
packages. ``nix-shell`` will automatically fetch all required dependencies and
make them available in the newly spawned shell.

Then proceed with ``make`` or ``make app`` according to the platform specific
instructions above.

.. _packagers:

Notes for Linux/macOS packagers
----------------------------------

The released |kitty| source code is available as a `tarball`_ from
`the GitHub releases page <https://github.com/kovidgoyal/kitty/releases>`__.

While |kitty| does use Python, it is not a traditional Python package, so please
do not install it in site-packages.
Instead run::

    make linux-package

This will install |kitty| into the directory :file:`linux-package`. You can run
|kitty| with :file:`linux-package/bin/kitty`. All the files needed to run kitty
will be in :file:`linux-package/lib/kitty`. The terminfo file will be installed
into :file:`linux-package/share/terminfo`. Simply copy these files into
:file:`/usr` to install |kitty|. In other words, :file:`linux-package` is the
staging area into which |kitty| is installed. You can choose a different staging
area, by passing the ``--prefix`` argument to :file:`setup.py`.

You should probably split |kitty| into three packages:

:code:`kitty-terminfo`
    Installs the terminfo file

:code:`kitty-shell-integration`
    Installs the shell integration scripts (the contents of the
    shell-integration directory in the kitty source code), probably to
    :file:`/usr/share/kitty/shell-integration`

:code:`kitty`
    Installs the main program

This allows users to install the terminfo and shell integration files on
servers into which they ssh, without needing to install all of |kitty|. The
shell integration files **must** still be present in
:file:`lib/kitty/shell-integration` when installing the kitty main package as
the kitty program expects to find them there.

.. note::
   You need a couple of extra dependencies to build linux-package. :file:`tic`
   to compile terminfo files, usually found in the development package of
   :file:`ncurses`. Also, if you are building from a git checkout instead of the
   released source code tarball, you will need to install the dependencies from
   :file:`docs/requirements.txt` to build the kitty documentation. They can be
   installed most easily with ``python -m pip -r docs/requirements.txt``.

This applies to creating packages for |kitty| for macOS package managers such as
Homebrew or MacPorts as well.

Cross compilation
-------------------

While cross compilation is neither officially supported, nor recommended, as it
means the test suite cannot be run for the cross compiled build, there is some
support for cross compilation. Basically, run::

    make prepare-for-cross-compile

Then setup the cross compile environment (CC, CFLAGS, PATH, etc.) and run::

    make cross-compile

This will create the cross compiled build in the :file:`linux-package`
directory.
```

## File: docs/clipboard.rst
```rst
Copying all data types to the clipboard
==============================================

There already exists an escape code to allow terminal programs to
read/write plain text data from the system clipboard, *OSC 52*.
kitty introduces a more advanced protocol that supports:

* Copy arbitrary data including images, rich text documents, etc.
* Allow terminals to ask the user for permission to access the clipboard and
  report permission denied

The escape code is *OSC 5522*, an extension of *OSC 52*. The basic format
of the escape code is::

    <OSC>5522;metadata;payload<ST>

Here, *metadata* is a colon separated list of key-value pairs and payload is
base64 encoded data. :code:`OSC` is :code:`<ESC>[`.
:code:`ST` is the string terminator, :code:`<ESC>\\`.

Reading data from the system clipboard
----------------------------------------

To read data from the system clipboard, the escape code is::

    <OSC>5522;type=read;<base 64 encoded space separated list of mime types to read><ST>

For example, to read plain text and PNG data, the payload would be::

    text/plain image/png

encoded as base64. To read from the primary selection instead of the
clipboard, add the key ``loc=primary`` to the metadata section.

To get the list of MIME types available on the clipboard the payload must be
just a period (``.``), encoded as base64.

The terminal emulator will reply with a sequence of escape codes of the form::

    <OSC>5522;type=read:status=OK<ST>
    <OSC>5522;type=read:status=DATA:mime=<base 64 encoded mime type>;<base64 encoded data><ST>
    <OSC>5522;type=read:status=DATA:mime=<base 64 encoded mime type>;<base64 encoded data><ST>
    .
    .
    .
    <OSC>5522;type=read:status=DONE<ST>

Here, the ``status=DATA`` packets deliver the data (as base64 encoded bytes)
associated with each MIME type. The terminal emulator should chunk up the data
for an individual type, into chunks of size **no more** than 4096 bytes (4096
is the size of a chunk *before* base64 encoding). All
the chunks for a given type must be transmitted sequentially and only once they
are done the chunks for the next type, if any, should be sent. The end of data
is indicated by a ``status=DONE`` packet.

If an error occurs, instead of the opening ``status=OK`` packet the terminal
must send a ``status=ERRORCODE`` packet. The error code must be one of:

``status=ENOSYS``
    Sent if the requested clipboard type is not available. For example, primary
    selection is not available on all systems and ``loc=primary`` was used.

``status=EPERM``
    Sent if permission to read from the clipboard was denied by the system or
    the user.

``status=EBUSY``
    Sent if there is some temporary problem, such as multiple clients in a
    multiplexer trying to access the clipboard simultaneously.

Terminals should ask the user for permission before allowing a read request.
However, if a read request only wishes to list the available data types on the
clipboard, it should be allowed without a permission prompt. This is so that
the user is not presented with a double permission prompt for reading the
available MIME types and then reading the actual data.


Writing data to the system clipboard
----------------------------------------

To write data to the system clipboard, the terminal programs sends the
following sequence of packets::

    <OSC>5522;type=write<ST>
    <OSC>5522;type=wdata:mime=<base64 encoded mime type>;<base 64 encoded chunk of data for this type><ST>
    <OSC>5522;type=wdata:mime=<base64 encoded mime type>;<base 64 encoded chunk of data for this type><ST>
    .
    .
    .
    <OSC>5522;type=wdata<ST>

The final packet with no mime and no data indicates end of transmission. The
data for every MIME type should be split into chunks of no more than 4096
bytes (4096 is the size of the data before base64 encoding).
All the chunks for a given MIME type must be sent sequentially, before
sending chunks for the next MIME type. After the transmission is complete, the
terminal replies with a single packet indicating success::

    <OSC>5522;type=write:status=DONE<ST>

If an error occurs the terminal can, at any time, send an error packet of the
form::

    <OSC>5522;type=write:status=ERRORCODE<ST>

Here ``ERRORCODE`` must be one of:

``status=EIO``
    An I/O error occurred while processing the data
``status=EINVAL``
    One of the packets was invalid, usually because of invalid base64 encoding.
``status=ENOSYS``
    The client asked to write to the primary selection with (``loc=primary``) and that is not
    available on the system
``status=EPERM``
    Sent if permission to write to the clipboard was denied by the system or
    the user.
``status=EBUSY``
    Sent if there is some temporary problem, such as multiple clients in a
    multiplexer trying to access the clipboard simultaneously.

Once an error occurs, the terminal must ignore all further OSC 5522 write related packets until it
sees the start of a new write with a ``type=write`` packet.

The client can send to the primary selection instead of the clipboard by adding
``loc=primary`` to the initial ``type=write`` packet.

Finally, clients have the ability to *alias* MIME types when sending data to
the clipboard. To do that, the client must send a ``type=walias`` packet of the
form::

    <OSC>5522;type=walias;mime=<base64 encoded target MIME type>;<base64 encoded, space separated list of aliases><ST>

The effect of an alias is that the system clipboard will make available all the
aliased MIME types, with the same data as was transmitted for the target MIME
type. This saves bandwidth, allowing the client to only transmit one copy of
the data, but create multiple references to it in the system clipboard. Alias
packets can be sent anytime after the initial write packet and before the end
of data packet.

.. _clipboard_repeated_permission:

Avoiding repeated permission prompts
--------------------------------------

.. versionadded:: 0.42.2
     using a password to avoid repeated confirmations

If a program like an editor wants to make use of the system clipboard, by
default, the user is prompted on every read request. This can become quite
fatiguing. To avoid this situation, this protocol allows sending a password
and human friendly name with ``type=write`` and ``type=read`` requests. The
terminal can then ask the user to allow all future requests using that
password. If the user agrees, future requests on the same tty will be
automatically allowed by the terminal. The editor or other program using
this facility should ideally use a password randomly generated at startup,
such as a UUID4. However, terminals may implement permanent/stored passwords.
Users can then configure terminal programs they trust to use these password.

The password and the human name are encoded using the ``pw`` and ``name`` keys
in the metadata. The values are UTF-8 strings that are base64 encoded.
Specifying a password without a human friendly name is equivalent to not
specifying a password and the terminal must treat the request as though
it had no password.

Allowing terminal applications to respond to paste events
--------------------------------------------------------------

.. versionadded:: 0.44.1
     paste events via the 5522 mode

If a TUI application wants to handle paste events (like the user pressing the
paste key shortcut used by the terminal or selecting paste from a terminal UI menu)
it can enable the *paste events* private mode (5522), as described in this `ancillary
specification <https://rockorager.dev/misc/bracketed-paste-mime/>`__. When that
mode is set, the terminal will send the application a list of MIME types on the
clipboard every time the user triggers a paste action. The application is then
free to request whatever MIME data it wants from the list of types.

The mode can be enabled using the standard DECSET or DECRST control sequences.
``CSI ? 5522 h`` to enable the mode. ``CSI ? 5522 l`` to disable the mode.

The terminal *should* send a one time password with the list of mime
types, as the ``pw`` key (base64 encoded). The application can then use this
password to request data from the clipboard without needing a permission
prompt. The human name *should* be set to ``Paste event`` (base64 encoded) when
the application uses this one time password.

Detecting support for this protocol
-----------------------------------------

Applications can detect if a terminal supports this protocol with a standard
DECRQM query:

.. code::

    CSI ? 5522 $ p

To which the terminal will respond with a DECRPM response:

.. code::

    CSI ? 5522 ; Ps $ y

A Ps value of 0 or 4 means the mode is not supported.


Support for terminal multiplexers
------------------------------------

Since this protocol involves two way communication between the terminal
emulator and the client program, multiplexers need a way to know which window
to send responses from the terminal to. In order to make this possible, the
metadata portion of this escape code includes an optional ``id`` field. If
present the terminal emulator must send it back unchanged with every response.
Valid ids must include only characters from the set: ``[a-zA-Z0-9-_+.]``. Any
other characters must be stripped out from the id by the terminal emulator
before retransmitting it.

Note that when using a terminal multiplexer it is possible for two different
programs to overwrite each other's clipboard requests. This is fundamentally
unavoidable since the system clipboard is a single global shared resource.
However, there is an additional complication where responses from this protocol
could get lost if, for instance, multiple write requests are received
simultaneously. It is up to well designed multiplexers to ensure that only a
single request is in flight at a time. The multiplexer can abort requests by
sending back the ``EBUSY`` error code indicating some other window is trying
to access the clipboard.

When the terminal sends an unsolicited paste event because the user triggered
a paste and the 5522 mode is enabled, there will be no associated id. In this
case, the multiplexer must forward the event to the currently active window.
```

## File: docs/color-stack.rst
```rst
Color control
====================

Saving and restoring colors
------------------------------

It is often useful for a full screen application with its own color themes to
set the default foreground, background, selection and cursor colors and the ANSI
color table. This allows for various performance optimizations when drawing the
screen. The problem is that if the user previously used the escape codes to
change these colors themselves, then running the full screen application will
lose those changes even after it exits. To avoid this, kitty introduces a new
pair of *OSC* escape codes to push and pop the current color values from a
stack::

    <ESC>]30001<ESC>\  # push onto stack
    <ESC>]30101<ESC>\  # pop from stack

These escape codes save/restore the colors, default background, default
foreground, selection background, selection foreground and cursor color and the
256 colors of the ANSI color table.

.. note:: In July 2020, after several years, xterm copied this protocol
   extension, without acknowledgement, and using incompatible escape codes
   (XTPUSHCOLORS, XTPOPCOLORS, XTREPORTCOLORS). And they decided to save not
   just the dynamic colors but the entire ANSI color table. In the interests of
   promoting interoperability, kitty added support for xterm's escape codes as
   well, and changed this extension to also save/restore the entire ANSI color
   table.

.. _color_control:

Setting and querying colors
-------------------------------

While there exists a legacy protocol developed by XTerm for querying and
setting colors, as with most XTerm protocols it suffers from the usual design
limitations of being under specified and in-sufficient. XTerm implements
querying of colors using OSC 4,5,6,10-19,104,105,106,110-119. This absurd
profusion of numbers is completely unnecessary, redundant and requires adding
two new numbers for every new color. Also XTerm's protocol doesn't handle the
case of colors that are unknown to the terminal or that are not a set value,
for example, many terminals implement selection as a reverse video effect not a
fixed color. The XTerm protocol has no way to query for this condition. The
protocol also doesn't actually specify the format in which colors are reported,
deferring to a man page for X11!

Instead kitty has developed a single number based protocol that addresses all
these shortcomings and is future proof by virtue of using string keys rather
than numbers. The syntax of the escape code is::

    <OSC> 21 ; key=value ; key=value ; ... <ST>

The spaces in the above definition are for reading clarity and should be ignored.
Here, ``<OSC>`` is the two bytes ``0x1b (ESC)`` and ``0x5d (])``. ``ST`` is
either ``0x7 (BEL)`` or the two bytes ``0x1b (ESC)`` and ``0x5c (\\)``.

``key`` is a number from 0-255 to query or set the color values from the
terminals ANSI color table, or one of the strings in the table below for
special colors:

================================= =============================================== ===============================
key                               meaning                                         dynamic
================================= =============================================== ===============================
foreground                        The default foreground text color               Not applicable
background                        The default background text color               Not applicable
selection_background              The background color of selections              Reverse video
selection_foreground              The foreground color of selections              Reverse video
cursor                            The color of the text cursor                    Foreground color
cursor_text                       The color of text under the cursor              Background color
visual_bell                       The color of a visual bell                      Automatic color selection based on current screen colors
transparent_background_color1..7  A background color that is rendered             Unset
                                  with the specified opacity in cells that have
                                  the specified background color. An opacity
                                  value less than zero means, use the
                                  :opt:`background_opacity` value.
================================= =============================================== ===============================

In this table the third column shows what effect setting the color to *dynamic*
has in kitty and many other terminal emulators. It is advisory only, terminal
emulators may not support dynamic colors for these or they may have other
effects. Setting the ANSI color table colors to dynamic is not allowed.

Querying current color values
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To query colors values, the client program sends this escape code with the
``value`` field set to ``?`` (the byte ``0x3f``). The terminal then responds
with the same escape code, but with the ``?`` replaced by the :ref:`encoded
color value <color_control_color_encoding>`. If the queried color is one that
does not have a defined value, for example, if the terminal is using a reverse
video effect or a gradient or similar, then the value must be empty, that is
the response contains only the key and ``=``, no value. For example, if the
client sends::

    <OSC> 21 ; foreground=? ; cursor=? <ST>

The terminal responds::

    <OSC> 21 ; foreground=rgb:ff/00/00 ; cursor= <ST>

This indicates that the foreground color is red and the cursor color is
undefined (typically the cursor takes the color of the text under it and the
text takes the color of the background).

If the terminal does not know a field that a client sends to it for a query it
must respond back with the ``field=?``, that is, it must send back a question
mark as the value.


Setting color values
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To set a color value, the client program sends this escape code with the
``value`` field set to either an :ref:`encoded color value
<color_control_color_encoding>` or the empty value. The empty value means
the terminal should use a dynamic color for example reverse video for
selections or similar. To reset a color to its default value (i.e. the value it
would have if it was never set) the client program should send just the key
name with no ``=`` and no value. For example::

    <OSC> 21 ; foreground=green ; cursor= ; background <ST>

This sets the foreground to the color green, sets the cursor color to dynamic
(usually meaning the cursor takes the color of the text under it) and resets
the background color to its default value.

To check if setting succeeded, the client can simply query the color, in fact
the two can be combined into a single escape code, for example::

    <OSC> 21 ; foreground=white ; foreground=? <ST>

The terminal will change the foreground color and reply with the new foreground
color.


.. _color_control_color_encoding:

Color value encoding
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The color encoding is inherited from the scheme used by XTerm, for
compatibility, but a sane, rigorously specified subset is chosen.

RGB colors are encoded in one of three forms:

``rgb:<red>/<green>/<blue>``
    | <red>, <green>, <blue> := h | hh | hhh | hhhh
    | h := single hexadecimal digits (case insignificant)
    | Note that h indicates the value scaled in 4 bits, hh the value scaled in 8 bits,
      hhh the value scaled in 12 bits, and hhhh the value scaled in 16 bits, respectively.

``#<h...>``
    | h := single hexadecimal digits (case insignificant)
    | #RGB            (4 bits each)
    | #RRGGBB         (8 bits each)
    | #RRRGGGBBB      (12 bits each)
    | #RRRRGGGGBBBB   (16 bits each)
    | The R, G, and B represent single hexadecimal digits.  When fewer than 16 bits
      each are specified, they represent the most significant bits of the value
      (unlike the “rgb:” syntax, in which values are scaled). For example,
      the string ``#3a7`` is the same as ``#3000a0007000``.

``rgbi:<red>/<green>/<blue>``
    red, green, and blue are floating-point values between 0.0 and 1.0, inclusive. The input format for these values is an optional
    sign, a string of numbers possibly containing a decimal point, and an optional exponent field containing an E or e followed by a possibly
    signed integer string. Values outside the ``0 - 1`` range must be clipped to be within the range.

If a color should have an alpha component, it must be suffixed to the color
specification in the form :code:`@number between zero and one`. For example::

    red@0.5 rgb:ff0000@0.1 #ff0000@0.3

The syntax for the floating point alpha component is the same as used for the
components of ``rgbi`` defined above. When not specified, the default alpha
value is ``1.0``. Values outside the range ``0 - 1`` must be clipped
to be within the range, negative values may have special context dependent
meaning.

In addition, the following color names are accepted (case-insensitively) corresponding to the
specified RGB values.

.. include:: generated/color-names.rst
```

## File: docs/conf.rst
```rst
kitty.conf
================

.. highlight:: conf


.. only:: man

    Overview
    --------------


|kitty| is highly customizable, everything from keyboard shortcuts, to rendering
frames-per-second. See below for an overview of all customization possibilities.

You can open the config file within |kitty| by pressing :sc:`edit_config_file`
(:kbd:`⌘+,` on macOS). A :file:`kitty.conf` with commented default
configurations and descriptions will be created if the file does not exist.
You can reload the config file within |kitty| by pressing
:sc:`reload_config_file` (:kbd:`⌃+⌘+,` on macOS) or sending |kitty| the
``SIGUSR1`` signal with ``kill -SIGUSR1 $KITTY_PID``. You can also display the
current configuration by pressing :sc:`debug_config` (:kbd:`⌥+⌘+,` on macOS).

.. _confloc:

|kitty| looks for a config file in the OS config directories (usually
:file:`~/.config/kitty/kitty.conf`) but you can pass a specific path via the
:option:`kitty --config` option or use the :envvar:`KITTY_CONFIG_DIRECTORY`
environment variable. See :option:`kitty --config` for full details.

**Comments** can be added to the config file as lines starting with the ``#``
character. This works only if the ``#`` character is the first character in the
line.

**Lines can be split** by starting the next line with the ``\`` character.
All leading whitespace and the ``\`` character are removed.

.. _include:

You can **include secondary config files** via the :code:`include` directive. If
you use a relative path for :code:`include`, it is resolved with respect to the
location of the current config file. Note that environment variables are
expanded, so :code:`${USER}.conf` becomes :file:`name.conf` if
:code:`USER=name`. A special environment variable :envvar:`KITTY_OS` is available,
to detect the operating system. It is ``linux``, ``macos`` or ``bsd``.
Also, you can use :code:`globinclude` to include files
matching a shell glob pattern and :code:`envinclude` to include configuration
from environment variables. Finally, you can dynamically generate configuration
by running a program using :code:`geninclude`. For example::

     # Include other.conf
     include other.conf
     # Include *.conf files from all subdirs of kitty.d inside the kitty config dir
     globinclude kitty.d/**/*.conf
     # Include the *contents* of all env vars starting with KITTY_CONF_
     envinclude KITTY_CONF_*
     # Run the script dynamic.py placed in the same directory as this config file
     # and include its :file:`STDOUT`. Note that Python scripts are fastest
     # as they use the embedded Python interpreter, but any executable script
     # or program is supported, in any language. Remember to mark the script
     # file executable.
     geninclude dynamic.py


.. note:: Syntax highlighting for :file:`kitty.conf` in vim is available via
   `vim-kitty <https://github.com/fladson/vim-kitty>`__.


.. include:: /generated/conf-kitty.rst


Sample kitty.conf
--------------------

.. only:: html

    You can download a sample :file:`kitty.conf` file with all default settings
    and comments describing each setting by clicking: :download:`sample
    kitty.conf </generated/conf/kitty.conf>`.

.. only:: man

   You can edit a fully commented sample kitty.conf by pressing the
   :sc:`edit_config_file` shortcut in kitty. This will generate a config file
   with full documentation and all settings commented out. If you have a
   pre-existing :file:`kitty.conf`, then that will be used instead, delete it to
   see the sample file.

A default configuration file can also be generated by running::

    kitty +runpy 'from kitty.config import *; print(commented_out_default_config())'

This will print the commented out default config file to :file:`STDOUT`.

All mappable actions
------------------------

See the :doc:`list of all the things you can make |kitty| can do </actions>`.

.. toctree::
   :hidden:

   actions
   wide-gamut-colors
```

## File: docs/deccara.rst
```rst
Setting text styles/colors in arbitrary regions of the screen
------------------------------------------------------------------

There already exists an escape code to set *some* text attributes in arbitrary
regions of the screen, `DECCARA
<https://vt100.net/docs/vt510-rm/DECCARA.html>`__. However, it is limited to
only a few attributes. |kitty| extends this to work with *all* SGR attributes.
So, for example, this can be used to set the background color in an arbitrary
region of the screen.

The motivation for this extension is the various problems with the existing
solution for erasing to background color, namely the *background color erase
(bce)* capability. See :iss:`this discussion <160#issuecomment-346470545>`
and `this FAQ <https://invisible-island.net/ncurses/ncurses.faq.html#bce_mismatches>`__
for a summary of problems with *bce*.

For example, to set the background color to blue in a rectangular region of the
screen from (3, 4) to (10, 11), you use::

    <ESC>[2*x<ESC>[4;3;11;10;44$r<ESC>[*x
```

## File: docs/desktop-notifications.rst
```rst
.. _notifications_on_the_desktop:


Desktop notifications
=======================

|kitty| implements an extensible escape code (OSC 99) to show desktop
notifications. It is easy to use from shell scripts and fully extensible to show
title and body. Clicking on the notification can optionally focus the window it
came from, and/or send an escape code back to the application running in that
window.

The design of the escape code is partially based on the discussion in the
defunct `terminal-wg <https://gitlab.freedesktop.org/terminal-wg/specifications/-/issues/13>`__

The escape code has the form::

    <OSC> 99 ; metadata ; payload <terminator>

Here ``<OSC>`` is :code:`<ESC>]` and ``<terminator>`` is
:code:`<ESC><backslash>`. The ``metadata`` is a section of colon separated
:code:`key=value` pairs. Every key must be a single character from the set
:code:`a-zA-Z` and every value must be a word consisting of characters from
the set :code:`a-zA-Z0-9-_/\+.,(){}[]*&^%$#@!`~`. The payload must be
interpreted based on the metadata section. The two semi-colons *must* always be
present even when no metadata is present.

Before going into details, let's see how one can display a simple, single line
notification from a shell script::

    printf '\x1b]99;;Hello world\x1b\\'

To show a message with a title and a body::

    printf '\x1b]99;i=1:d=0;Hello world\x1b\\'
    printf '\x1b]99;i=1:p=body;This is cool\x1b\\'

.. tip::

   |kitty| also comes with its own :doc:`statically compiled command line tool </kittens/notify>` to easily display
   notifications, with all their advanced features. For example:

   .. code-block:: sh

        kitten notify "Hello world" A good day to you

The most important key in the metadata is the ``p`` key, it controls how the
payload is interpreted. A value of ``title`` means the payload is setting the
title for the notification. A value of ``body`` means it is setting the body,
and so on, see the table below for full details.

The design of the escape code is fundamentally chunked, this is because
different terminal emulators have different limits on how large a single escape
code can be. Chunking is accomplished by the ``i`` and ``d`` keys. The ``i``
key is the *notification id* which is an :ref:`identifier`.
The ``d`` key stands for *done* and can only take the
values ``0`` and ``1``. A value of ``0`` means the notification is not yet done
and the terminal emulator should hold off displaying it. A non-zero value means
the notification is done, and should be displayed. You can specify the title or
body multiple times and the terminal emulator will concatenate them, thereby
allowing arbitrarily long text (terminal emulators are free to impose a sensible
limit to avoid Denial-of-Service attacks). The size of the payload must be no
longer than ``2048`` bytes, *before being encoded* or ``4096`` encoded bytes.

Both the ``title`` and ``body`` payloads must be either :ref:`safe_utf8` text
or UTF-8 text that is :ref:`base64` encoded, in which case there must be an
``e=1`` key in the metadata to indicate the payload is :ref:`base64`
encoded. No HTML or other markup in the plain text is allowed. It is strictly
plain text, to be interpreted as such.

Allowing users to filter notifications
-------------------------------------------------------

.. versionadded:: 0.36.0
   Specifying application name and notification type

Well behaved applications should identify themselves to the terminal
by means of two keys ``f`` which is the application name and ``t``
which is the notification type. These are free form keys, they can contain
any values, their purpose is to allow users to easily filter out
notifications they do not want. Both keys must have :ref:`base64`
encoded UTF-8 text as their values. The ``t`` key can be specified multiple
times, as notifications can have more than one type. See the `freedesktop.org
spec
<https://specifications.freedesktop.org/notification-spec/notification-spec-latest.html#categories>`__
for examples of notification types.

.. note::
   The application name should generally be set to the filename of the
   applications `desktop file
   <https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html#file-naming>`__
   (without the ``.desktop`` part) or the bundle identifier for a macOS
   application. While not strictly necessary, this allows the terminal
   emulator to deduce an icon for the notification when one is not specified.

.. tip::

   |kitty| has sophisticated notification filtering and management
   capabilities via :opt:`filter_notification`.


Being informed when user activates the notification
-------------------------------------------------------

When the user clicks the notification, a couple of things can happen, the
terminal emulator can focus the window from which the notification came, and/or
it can send back an escape code to the application indicating the notification
was activated. This is controlled by the ``a`` key which takes a comma separated
set of values, ``report`` and ``focus``. The value ``focus`` means focus the
window from which the notification was issued and is the default. ``report``
means send an escape code back to the application. The format of the returned
escape code is::

    <OSC> 99 ; i=identifier ; <terminator>

The value of ``identifier`` comes from the ``i`` key in the escape code sent by
the application. If the application sends no identifier, then the terminal
*must* use ``i=0``. (Ideally ``i`` should have been left out from the response,
but for backwards compatibility ``i=0`` is used). Actions can be preceded by a
negative sign to turn them off, so for example if you do not want any action,
turn off the default ``focus`` action with::

    a=-focus

Complete specification of all the metadata keys is in the :ref:`table below <keys_in_notificatons_protocol>`.
If a terminal emulator encounters a key in the metadata it does not understand,
the key *must* be ignored, to allow for future extensibility of this escape
code. Similarly if values for known keys are unknown, the terminal emulator
*should* either ignore the entire escape code or perform a best guess effort to
display it based on what it does understand.


Being informed when a notification is closed
------------------------------------------------

.. versionadded:: 0.36.0
   Notifications of close events

If you wish to be informed when a notification is closed, you can specify
``c=1`` when sending the notification. For example::

    <OSC> 99 ; i=mynotification : c=1 ; hello world <terminator>

Then, the terminal will send the following
escape code to inform when the notification is closed::

    <OSC> 99 ; i=mynotification : p=close ; <terminator>

If no notification id was specified ``i=0`` will be used in the response

If ``a=report`` is specified and the notification is activated/clicked on
then both the activation report and close notification are sent. If the notification
is updated then the close event is not sent unless the updated notification
also requests a close notification.

Note that on some platforms, such as macOS, the OS does not inform applications
when notifications are closed, on such platforms, terminals reply with::

    <OSC> 99 ; i=mynotification : p=close ; untracked <terminator>

This means that the terminal has no way of knowing when the notification is
closed. Instead, applications can poll the terminal to determine which
notifications are still alive (not closed), with::

    <OSC> 99 ; i=myid : p=alive ; <terminator>

The terminal will reply with::

    <OSC> 99 ; i=myid : p=alive ; id1,id2,id3 <terminator>

Here, ``myid`` is present for multiplexer support. The response from the terminal
contains a comma separated list of ids that are still alive.


Updating or closing an existing notification
----------------------------------------------

.. versionadded:: 0.36.0
   The ability to update and close a previous notification

To update a previous notification simply send a new notification with the same
*notification id* (``i`` key) as the one you want to update. If the original
notification is still displayed it will be replaced, otherwise a new
notification is displayed. This can be used, for example, to show progress of
an operation. How smoothly the existing notification is replaced
depends on the underlying OS, for example, on Linux the replacement is usually flicker
free, on macOS it isn't, because of Apple's design choices.
Note that if no ``i`` key is specified, no updating must take place, even if
there is a previous notification without an identifier. The terminal must
treat these as being two unique *unidentified* notifications.

To close a previous notification, send::

    <OSC> i=<notification id> : p=close ; <terminator>

This will close a previous notification with the specified id. If no such
notification exists (perhaps because it was already closed or it was activated)
then the request is ignored. If no ``i`` key is specified, this must be a no-op.


Automatically expiring notifications
-------------------------------------

A notification can be marked as expiring (being closed) automatically after
a specified number of milliseconds using the ``w`` key. The default if
unspecified is ``-1`` which means to use whatever expiry policy the OS has for
notifications. A value of ``0`` means the notification should never expire.
Values greater than zero specify the number of milliseconds after which the
notification should be auto-closed. Note that the value of ``0``
is best effort, some platforms honor it and some do not. Positive values
are robust, since they can be implemented by the terminal emulator itself,
by manually closing the notification after the expiry time. The notification
could still be closed before the expiry time by user interaction or OS policy,
but it is guaranteed to be closed once the expiry time has passed.


Adding icons to notifications
--------------------------------

.. versionadded:: 0.36.0
   Custom icons in notifications

Applications can specify a custom icon to be displayed with a notification.
This can be the application's logo or a symbol such as error or warning
symbols. The simplest way to specify an icon is by *name*, using the ``n``
key. The value of this key is :ref:`base64` encoded UTF-8 text. Names
can be either application names, or symbol names. The terminal emulator
will try to resolve the name based on icons and applications available
on the computer it is running on. The following list of well defined names
must be supported by any terminal emulator implementing this spec.
The ``n`` key can be specified multiple times, the terminal will go through
the list in order and use the first icon that it finds available on the
system.

.. table:: Universally available icon names

   ======================== ==============================================
   Name                     Description
   ======================== ==============================================
   ``error``                An error symbol
   ``warn``, ``warning``    A warning symbol
   ``info``                 A symbol denoting an informational message
   ``question``             A symbol denoting asking the user a question
   ``help``                 A symbol denoting a help message
   ``file-manager``         A symbol denoting a generic file manager application
   ``system-monitor``       A symbol denoting a generic system monitoring/information application
   ``text-editor``          A symbol denoting a generic text editor application
   ======================== ==============================================

If an icon name is an application name it should be an application identifier,
such as the filename of the application's :file:`.desktop` file on Linux or its
bundle identifier on macOS. For example if the cross-platform application
FooBar has a desktop file named: :file:`foo-bar.desktop` and a bundle
identifier of ``net.foo-bar-website.foobar`` then it should use the icon names
``net.foo-bar-website.foobar`` *and* ``foo-bar`` so that terminals running on
both platforms can find the application icon.

If no icon is specified, but the ``f`` key (application name) is specified, the
terminal emulator should use the value of the ``f`` key to try to find a
suitable icon.

Adding icons by transmitting icon data
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This can be done by using the ``p=icon`` key. Then, the payload is the icon
image in any of the ``PNG``, ``JPEG`` or ``GIF`` image formats. It is recommended
to use an image size of ``256x256`` for icons. Since icons are binary data,
they must be transmitted encoded, with ``e=1``.

When both an icon name and an image are specified, the terminal emulator must
first try to find a locally available icon matching the name and only if one
is not found, fallback to the provided image. This is so that users are
presented with icons from their current icon theme, where possible.

Transmitted icon data can be cached using the ``g`` key. The value of the ``g``
key must be a random globally unique UUID like :ref:`identifier`. Then, the
terminal emulator will cache the transmitted data using that key. The cache
should exist for as long as the terminal emulator remains running. Thus, in
future notifications, the application can simply send the ``g`` key to display
a previously cached icon image with needing to re-transmit the actual data with
``p=icon``. The ``g`` key refers only to the icon data, multiple different
notifications with different icon or application names can use the same ``g``
key to refer to the same icon. Terminal multiplexers must cache icon data
themselves and refresh it in the underlying terminal implementation when
detaching and then re-attaching. This means that applications once started
need to transmit icon data only once until they are quit.

.. note::
   To avoid DoS attacks terminal implementations can impose a reasonable max size
   on the icon cache and evict icons in order of last used. Thus theoretically,
   a previously cached icon may become unavailable, but given that icons are
   small images, practically this is not an issue in all but the most resource
   constrained environments, and the failure mode is simply that the icon is not
   displayed.

.. note::
   How the icon is displayed depends on the underlying OS notifications
   implementation. For example, on Linux, typically a single icon is displayed.
   On macOS, both the terminal emulator's icon and the specified custom icon
   are displayed.


Adding buttons to the notification
---------------------------------------

Buttons can be added to the notification using the *buttons* payload, with ``p=buttons``.
Buttons are a list of UTF-8 text separated by the Unicode Line Separator
character (U+2028) which is the UTF-8 bytes ``0xe2 0x80 0xa8``. They can be
sent either as :ref:`safe_utf8` or :ref:`base64`. When the user clicks on one
of the buttons, and reporting is enabled with ``a=report``, the terminal will
send an escape code of the form::

    <OSC> 99 ; i=identifier ; button_number <terminator>

Here, `button_number` is a number from 1 onwards, where 1 corresponds
to the first button, two to the second and so on. If the user activates the
notification as a whole, and not a specific button, the response, as described
above is::

    <OSC> 99 ; i=identifier ; <terminator>

If no identifier was specified when creating the notification, ``i=0`` is used.
The terminal *must not* send a response unless report is requested with
``a=report``.

.. note::

   The appearance of the buttons depends on the underlying OS implementation.
   On most Linux systems, the buttons appear as individual buttons on the
   notification. On macOS they appear as a drop down menu that is accessible
   when hovering the notification. Generally, using more than two or three
   buttons is not a good idea.

.. _notifications_query:

Playing a sound with notifications
-----------------------------------------

.. versionadded:: 0.36.0
   The ability to control the sound played with notifications

By default, notifications may or may not have a sound associated with them
depending on the policies of the OS notifications service. Sometimes it
might be useful to ensure a notification is not accompanied by a sound.
This can be done by using the ``s`` key which accepts :ref:`base64` encoded
UTF-8 text as its value. The set of known sounds names is in the table below,
any other names are implementation dependent, for instance, on Linux, terminal emulators will
probably support the `standard sound names
<https://specifications.freedesktop.org/sound-naming-spec/latest/#names>`__

.. table:: Standard sound names

   ======================== ==============================================
   Name                     Description
   ======================== ==============================================
   ``system``               The default system sound for a notification, which may be some kind of beep or just silence
   ``silent``               No sound must accompany the notification
   ``error``                A sound associated with error messages
   ``warn``, ``warning``    A sound associated with warning messages
   ``info``                 A sound associated with information messages
   ``question``             A sound associated with questions
   ======================== ==============================================

Support for sound names can be queried as described below.


Querying for support
-------------------------

.. versionadded:: 0.36.0
   The ability to query for support

An application can query the terminal emulator for support of this protocol, by
sending the following escape code::

    <OSC> 99 ; i=<some identifier> : p=? ; <terminator>

A conforming terminal must respond with an escape code of the form::

    <OSC> 99 ; i=<some identifier> : p=? ; key=value : key=value <terminator>

The identifier is present to support terminal multiplexers, so that they know
which window to redirect the query response too.

Here, the ``key=value`` parts specify details about what the terminal
implementation supports. Currently, the following keys are defined:

=======  ================================================================================
Key      Value
=======  ================================================================================
``a``    Comma separated list of actions from the ``a`` key that the terminal
         implements. If no actions are supported, the ``a`` key must be absent from the
         query response.

``c``    ``c=1`` if the terminal supports close events, otherwise the ``c``
         must be omitted.

``o``    Comma separated list of occasions from the ``o`` key that the
         terminal implements. If no occasions are supported, the value
         ``o=always`` must be sent in the query response.

``p``    Comma separated list of supported payload types (i.e. values of the
         ``p`` key that the terminal implements). These must contain at least
         ``title``.

``s``    Comma separated list of sound names from the table of standard sound names above.
         Terminals will report the list of standard sound names they support.
         Terminals *should* support at least ``system`` and ``silent``.

``u``    Comma separated list of urgency values that the terminal implements.
         If urgency is not supported, the ``u`` key must be absent from the
         query response.

``w``    ``w=1`` if the terminal supports auto expiring of notifications.
=======  ================================================================================

In the future, if this protocol expands, more keys might be added. Clients must
ignore keys they do not understand in the query response.

To check if a terminal emulator supports this notifications protocol the best way is to
send the above *query action* followed by a request for the `primary device
attributes <https://vt100.net/docs/vt510-rm/DA1.html>`_. If you get back an
answer for the device attributes without getting back an answer for the *query
action* the terminal emulator does not support this notifications protocol.

.. _keys_in_notificatons_protocol:

Specification of all keys used in the protocol
--------------------------------------------------

=======  ====================  ========== =================
Key      Value                 Default    Description
=======  ====================  ========== =================
``a``    Comma separated list  ``focus``  What action to perform when the
         of ``report``,                   notification is clicked
         ``focus``, with
         optional leading
         ``-``

``c``    ``0`` or ``1``        ``0``      When non-zero an escape code is sent to the application when the notification is closed.

``d``    ``0`` or ``1``        ``1``      Indicates if the notification is
                                          complete or not. A non-zero value
                                          means it is complete.

``e``    ``0`` or ``1``        ``0``      If set to ``1`` means the payload is :ref:`base64` encoded UTF-8,
                                          otherwise it is plain UTF-8 text with no C0 control codes in it

``f``    :ref:`base64`         ``unset``  The name of the application sending the notification. Can be used to filter out notifications.
         encoded UTF-8
         application name

``g``    :ref:`identifier`     ``unset``  Identifier for icon data. Make these globally unique,
                                          like an UUID.

``i``    :ref:`identifier`     ``unset``  Identifier for the notification. Make these globally unique,
                                          like an UUID, so that terminal multiplexers can
                                          direct responses to the correct window. Note that for backwards
                                          compatibility reasons i=0 is special and should not be used.

``n``    :ref:`base64`         ``unset``  Icon name. Can be specified multiple times.
         encoded UTF-8
         application name

``o``    One of ``always``,    ``always`` When to honor the notification request. ``unfocused`` means when the window
         ``unfocused`` or                 the notification is sent on does not have keyboard focus. ``invisible``
         ``invisible``                    means the window both is unfocused
                                          and not visible to the user, for example, because it is in an inactive tab or
                                          its OS window is not currently active.
                                          ``always`` is the default and always honors the request.

``p``    One of ``title``,     ``title``  Type of the payload. If a notification has no title, the body will be used as title.
         ``body``,                        A notification with not title and no body is ignored. Terminal
         ``close``,                       emulators should ignore payloads of unknown type to allow for future
         ``icon``,                        expansion of this protocol.
         ``?``, ``alive``,
         ``buttons``

``s``    :ref:`base64`         ``system`` The sound name to play with the notification. ``silent`` means no sound.
         encoded sound                    ``system`` means to play the default sound, if any, of the platform notification service.
         name                             Other names are implementation dependent.

``t``    :ref:`base64`         ``unset``  The type of the notification. Used to filter out notifications. Can be specified multiple times.
         encoded UTF-8
         notification type

``u``    ``0, 1 or 2``         ``unset``  The *urgency* of the notification. ``0`` is low, ``1`` is normal and ``2`` is critical.
                                          If not specified normal is used.


``w``    ``>=-1``              ``-1``     The number of milliseconds to auto-close the notification after.
=======  ====================  ========== =================


.. versionadded:: 0.35.0
   Support for the ``u`` key to specify urgency

.. versionadded:: 0.31.0
   Support for the ``o`` key to prevent notifications from focused windows


.. note::
   |kitty| also supports the `legacy OSC 9 protocol developed by iTerm2
   <https://iterm2.com/documentation-escape-codes.html>`__ for desktop
   notifications.


.. _base64:

Base64
---------------

The base64 encoding used in the this specification is the one defined in
:rfc:`4648`. When a base64 payload is chunked, either the chunking should be
done before encoding or after. When the chunking is done before encoding, no
more than 2048 bytes of data should be encoded per chunk and the encoded data
**must** include the base64 padding bytes, if any. When the chunking is done
after encoding, each encoded chunk must be no more than 4096 bytes in size.
There may or may not be padding bytes at the end of the last chunk, terminals
must handle either case.


.. _safe_utf8:

Escape code safe UTF-8
--------------------------

This must be valid UTF-8 as per the spec in :rfc:`3629`. In addition, in order
to make it safe for transmission embedded inside an escape code, it must
contain none of the C0 and C1 control characters, that is, the Unicode
characters: U+0000 (NUL) - U+1F (Unit separator), U+7F (DEL) and U+80 (PAD) - U+9F
(APC). Note that in particular, this means that no newlines, carriage returns,
tabs, etc. are allowed.


.. _identifier:

Identifier
----------------

Any string consisting solely of characters from the set ``[a-zA-Z0-9_-+.]``,
that is, the letters ``a-z``, ``A-Z``, the underscore, the hyphen, the plus
sign and the period. Applications should make these globally unique, like a
UUID for maximum robustness.


.. important::
   Terminals **must** sanitize ids received from client programs before sending
   them back in responses, to mitigate input injection based attacks. That is, they must
   either reject ids containing characters not from the above set, or remove
   bad characters when reading ids sent to them.
```

## File: docs/faq.rst
```rst
Frequently Asked Questions
==============================

.. highlight:: sh

Some special symbols are rendered small/truncated in kitty?
-----------------------------------------------------------

The number of cells a Unicode character takes up are controlled by the Unicode
standard. All characters are rendered in a single cell unless the Unicode
standard says they should be rendered in two cells. When a symbol does not fit,
it will either be rescaled to be smaller or truncated (depending on how much
extra space it needs). This is often different from other terminals which just
let the character overflow into neighboring cells, which is fine if the
neighboring cell is empty, but looks terrible if it is not.

Some programs, like Powerline, vim with fancy gutter symbols/status-bar, etc.
use Unicode characters from the private use area to represent symbols. Often
these symbols are wide and should be rendered in two cells. However, since
private use area symbols all have their width set to one in the Unicode
standard, |kitty| renders them either smaller or truncated. The exception is if
these characters are followed by a space or en-space (U+2002) in which case
kitty makes use of the extra cell to render them in two cells. This behavior
can be turned off for specific symbols using :opt:`narrow_symbols`.

As of version 0.40 kitty has innovated a :doc:`new protocol
<text-sizing-protocol>` that allows programs running in the terminal to control
how many cells a character is rendered in thereby solving the issue of
character width once and for all.

Similarly, some monospaced font families are buggy and have bold or italic
faces that have characters wider than the width of the normal face, these
will also result in clipping. Such issues should be reported to the font
developer. Monospaced font families must have all their characters rendered
within a fixed width across all faces of the font, otherwise they aren't really
monospaced.


Using a color theme with a background color does not work well in vim?
-----------------------------------------------------------------------

First, be sure to `use a color scheme in vim <https://github.com/kovidgoyal/kitty/discussions/8196#discussioncomment-11739991>`__
instead of relying on the terminal theme. Otherwise, background and text selection colours
may be difficult to read.

Sadly, vim has very poor out-of-the-box detection for modern terminal features.
Furthermore, it `recently broke detection even more <https://github.com/vim/vim/issues/11729>`__.
It kind of, but not really, supports terminfo, except it overrides it with its own hard-coded
values when it feels like it. Worst of all, it has no ability to detect modern
features not present in terminfo, at all, even security sensitive ones like
bracketed paste.

Thankfully, probably as a consequence of this lack of detection, vim allows users to
configure these low level details. So, to make vim work well with any modern
terminal, including kitty, add the following to your :file:`~/.vimrc`.

.. code-block:: vim

    " Mouse support
    set mouse=a
    set ttymouse=sgr
    set balloonevalterm
    " Styled and colored underline support
    let &t_AU = "\e[58:5:%dm"
    let &t_8u = "\e[58:2:%lu:%lu:%lum"
    let &t_Us = "\e[4:2m"
    let &t_Cs = "\e[4:3m"
    let &t_ds = "\e[4:4m"
    let &t_Ds = "\e[4:5m"
    let &t_Ce = "\e[4:0m"
    " Strikethrough
    let &t_Ts = "\e[9m"
    let &t_Te = "\e[29m"
    " Truecolor support
    let &t_8f = "\e[38:2:%lu:%lu:%lum"
    let &t_8b = "\e[48:2:%lu:%lu:%lum"
    let &t_RF = "\e]10;?\e\\"
    let &t_RB = "\e]11;?\e\\"
    " Bracketed paste
    let &t_BE = "\e[?2004h"
    let &t_BD = "\e[?2004l"
    let &t_PS = "\e[200~"
    let &t_PE = "\e[201~"
    " Cursor control
    let &t_RC = "\e[?12$p"
    let &t_SH = "\e[%d q"
    let &t_RS = "\eP$q q\e\\"
    let &t_SI = "\e[5 q"
    let &t_SR = "\e[3 q"
    let &t_EI = "\e[1 q"
    let &t_VS = "\e[?12l"
    " Focus tracking
    let &t_fe = "\e[?1004h"
    let &t_fd = "\e[?1004l"
    execute "set <FocusGained>=\<Esc>[I"
    execute "set <FocusLost>=\<Esc>[O"
    " Window title
    let &t_ST = "\e[22;2t"
    let &t_RT = "\e[23;2t"

    " vim hardcodes background color erase even if the terminfo file does
    " not contain bce. This causes incorrect background rendering when
    " using a color theme with a background color in terminals such as
    " kitty that do not support background color erase.
    let &t_ut=''

These settings must be placed **before** setting the ``colorscheme``. It is
also important that the value of the vim ``term`` variable is not changed
after these settings.

I get errors about the terminal being unknown or opening the terminal failing or functional keys like arrow keys don't work?
-------------------------------------------------------------------------------------------------------------------------------

These issues all have the same root cause: the kitty terminfo files not being
available. The most common way this happens is SSHing into a computer that does
not have the kitty terminfo files. The simplest fix for that is running::

    kitten ssh myserver

It will automatically copy over the terminfo files and also magically enable
:doc:`shell integration </shell-integration>` on the remote machine.

This :doc:`ssh kitten <kittens/ssh>` takes all the same command line arguments
as :program:`ssh`, you can alias it to something small in your shell's rc files
to avoid having to type it each time::

    alias s="kitten ssh"

If this does not work, see :ref:`manual_terminfo_copy` for alternative ways to
get the kitty terminfo files onto a remote computer.

The next most common reason for this is if you are running commands as root
using :program:`sudo` or :program:`su`. These programs often filter the
:envvar:`TERMINFO` environment variable which is what points to the kitty
terminfo files.

First, make sure the :envvar:`TERM` is set to ``xterm-kitty`` in the sudo
environment. By default, it should be automatically copied over.

If you are using a well maintained Linux distribution, it will have a
``kitty-terminfo`` package that you can simply install to make the kitty
terminfo files available system-wide. Then the problem will no longer occur.

Alternately, you can configure :program:`sudo` to preserve :envvar:`TERMINFO`
by running ``sudo visudo`` and adding the following line::

    Defaults env_keep += "TERM TERMINFO"

If none of these are suitable for you, you can run sudo as ::

    sudo TERMINFO="$TERMINFO"

This will make :envvar:`TERMINFO` available
in the sudo environment. Create an alias in your shell rc files to make this
convenient::

    alias sudo="sudo TERMINFO=\"$TERMINFO\""

If you have double width characters in your prompt, you may also need to
explicitly set a UTF-8 locale, like::

    export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8


I cannot use the key combination X in program Y?
-------------------------------------------------------

First, run::

    kitten show-key -m kitty

Press the key combination X. If the kitten reports the key press
that means kitty is correctly sending the key press to terminal programs.
You need to report the issue to the developer of the terminal program. Most
likely they have not added support for :doc:`/keyboard-protocol`.

If the kitten does not report it, it means that the key is bound to some action
in kitty. You can unbind it in :file:`kitty.conf` with:

.. code-block:: conf

   map X no_op

Here X is the keys you press on the keyboard. So for example
:kbd:`ctrl+shift+1`.


How do I change the colors in a running kitty instance?
------------------------------------------------------------

The easiest way to do it is to use the :doc:`themes kitten </kittens/themes>`,
to choose a new color theme. Simply run::

    kitten themes

And choose your theme from the list.

You can also define keyboard shortcuts to set colors, for example::

    map f1 set_colors --configured /path/to/some/config/file/colors.conf

Or you can enable :doc:`remote control <remote-control>` for |kitty| and use
:ref:`at-set-colors`. The shortcut mapping technique has the same syntax as the
remote control command, for details, see :ref:`at-set-colors`.

To change colors when SSHing into a remote host, use the :opt:`color_scheme
<kitten-ssh.color_scheme>` setting for the :doc:`ssh kitten <kittens/ssh>`.

Additionally, you can use the escape code described in :doc:`color-stack`
to set colors in a single window.
Examples of using OSC escape codes to set colors::

    Change the default foreground color:
    printf '\x1b]21;foreground=#ff0000\x1b\\'
    Change the default background color:
    printf '\x1b]21;background=blue\x1b\\'
    Change the cursor color:
    printf '\x1b]21;cursor=blue\x1b\\'
    Change the selection background color:
    printf '\x1b]21;selection_background=blue\x1b\\'
    Change the selection foreground color:
    printf '\x1b]21;selection_foreground=blue\x1b\\'
    Change the nth color (0 - 255):
    printf '\x1b]21;n=green\x1b\\'

See :doc:`color-stack` for details on the syntax for specifying colors and
how to query current colors.


How do I specify command line options for kitty on macOS?
---------------------------------------------------------------

Apple does not want you to use command line options with GUI applications. To
workaround that limitation, |kitty| will read command line options from the file
:file:`<kitty config dir>/macos-launch-services-cmdline` when it is launched
from the GUI, i.e. by clicking the |kitty| application icon or using
``open -a kitty``. Note that this file is *only read* when running via the GUI.
The contents of the file are assumed to be the command line to pass to kitty in
shell syntax, for example::

    --single-instance --override background=red

You can, of course, also run |kitty| from a terminal with command line options,
using: :file:`/Applications/kitty.app/Contents/MacOS/kitty`.

And within |kitty| itself, you can always run |kitty| using just ``kitty`` as it
cleverly adds itself to the :envvar:`PATH`.


I catted a binary file and now kitty is hung?
-----------------------------------------------

**Never** output unknown binary data directly into a terminal.

Terminals have a single channel for both data and control. Certain bytes
are control codes. Some of these control codes are of arbitrary length, so if
the binary data you output into the terminal happens to contain the starting
sequence for one of these control codes, the terminal will hang waiting for the
closing sequence. Press :sc:`reset_terminal` to reset the terminal.

If you do want to cat unknown data, use ``cat -v``.


kitty is not able to use my favorite font?
---------------------------------------------

|kitty| achieves its stellar performance by caching alpha masks of each rendered
character on the GPU, and rendering them all in parallel. This means it is a
strictly character cell based display. As such it can use only monospace fonts,
since every cell in the grid has to be the same size. Furthermore, it needs
fonts to be freely resizable, so it does not support bitmapped fonts.

.. note::
   If you are trying to use a font patched with `Nerd Fonts
   <https://nerdfonts.com/>`__ symbols, don't do that as patching destroys
   fonts. There is no need, kitty has a builtin NERD font and will use it for
   symbols not found in any other font on your system.
   If you have patched fonts on your system they might be used instead for NERD
   symbols, so to force kitty to use the pure NERD font for NERD symbols,
   add the following line to :file:`kitty.conf`::

        # Nerd Fonts v3.3.0

        symbol_map U+e000-U+e00a,U+ea60-U+ebeb,U+e0a0-U+e0c8,U+e0ca,U+e0cc-U+e0d7,U+e200-U+e2a9,U+e300-U+e3e3,U+e5fa-U+e6b7,U+e700-U+e8ef,U+ed00-U+efc1,U+f000-U+f2ff,U+f000-U+f2e0,U+f300-U+f381,U+f400-U+f533,U+f0001-U+f1af0 Symbols Nerd Font Mono

   Those Unicode symbols not in the `Unicode private use areas
   <https://en.wikipedia.org/wiki/Private_Use_Areas>`__ are
   not included.

If your font is not listed in ``kitten choose-fonts`` it means that it is not
monospace or is a bitmapped font. On Linux you can list all monospace fonts
with::

    fc-list : family spacing outline scalable | grep -e spacing=100 -e spacing=90 | grep -e outline=True | grep -e scalable=True

On macOS, you can open *Font Book* and look in the :guilabel:`Fixed width`
collection to see all monospaced fonts on your system.

Note that **on Linux**, the spacing property is calculated by fontconfig based on actual glyph
widths in the font. If for some reason fontconfig concludes your favorite
monospace font does not have ``spacing=100`` you can override it by using the
following :file:`~/.config/fontconfig/fonts.conf`::

    <?xml version="1.0"?>
    <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
    <fontconfig>
    <match target="scan">
        <test name="family">
            <string>Your Font Family Name</string>
        </test>
        <edit name="spacing">
            <int>100</int>
        </edit>
    </match>
    </fontconfig>

After creating (or modifying) this file, you may need to run the following
command to rebuild your fontconfig cache::

    fc-cache -r

Then, the font will be available in ``kitten choose-fonts``.


How can I assign a single global shortcut to bring up the kitty terminal?
-----------------------------------------------------------------------------

Use the :ref:`panel kitten <quake>`, this allows you to use kitty as a quick
access Quake like terminal and even to use kitty as the desktop background, if
so desired.


I do not like the kitty icon!
-------------------------------

The kitty icon was created as tribute to my cat of nine years who passed away,
as such it is not going to change. However, if you do not like it, there are
many alternate icons available, click on an icon to visit its homepage:

.. image:: https://github.com/k0nserv/kitty-icon/raw/main/kitty.iconset/icon_256x256.png
   :target: https://github.com/k0nserv/kitty-icon
   :width: 256

.. image:: https://github.com/DinkDonk/kitty-icon/raw/main/kitty-dark.png
   :target: https://github.com/DinkDonk/kitty-icon
   :width: 256

.. image:: https://github.com/DinkDonk/kitty-icon/raw/main/kitty-light.png
   :target: https://github.com/DinkDonk/kitty-icon
   :width: 256

.. image:: https://github.com/hristost/kitty-alternative-icon/raw/main/kitty_icon.png
   :target: https://github.com/hristost/kitty-alternative-icon
   :width: 256

.. image:: https://github.com/igrmk/whiskers/raw/main/whiskers.svg
   :target: https://github.com/igrmk/whiskers
   :width: 256

.. image:: https://github.com/samholmes/whiskers/raw/main/whiskers.png
   :target: https://github.com/samholmes/whiskers
   :width: 256

.. image:: https://github.com/user-attachments/assets/a37d7830-4a8c-45a8-988a-3e98a41ea541
   :target: https://github.com/diegobit/kitty-icon
   :width: 256

.. image:: https://github.com/eccentric-j/eccentric-icons/raw/main/icons/kitty-terminal/2d/kitty-preview.png
   :target: https://github.com/eccentric-j/eccentric-icons
   :width: 256

.. image:: https://github.com/eccentric-j/eccentric-icons/raw/main/icons/kitty-terminal/3d/kitty-preview.png
   :target: https://github.com/eccentric-j/eccentric-icons
   :width: 256

.. image:: https://github.com/sodapopcan/kitty-icon/raw/main/kitty.app.png
   :target: https://github.com/sodapopcan/kitty-icon
   :width: 256

.. image:: https://github.com/sfsam/some_icons/raw/main/kitty.app.iconset/icon_128x128@2x.png
   :target: https://github.com/sfsam/some_icons
   :width: 256

.. image:: https://github.com/igrmk/twiskers/raw/main/icon/twiskers.svg
   :target: https://github.com/igrmk/twiskers
   :width: 256

.. image:: https://github.com/mtklr/kitty-nyan-icon/raw/main/kitty-nyan.svg
   :target: https://github.com/mtklr/kitty-nyan-icon
   :width: 256

You can put :file:`kitty.app.icns` (macOS only) or :file:`kitty.app.png` in the
:ref:`kitty configuration directory <confloc>`, and this icon will be applied
automatically at startup. On X11 and Wayland, this will set the icon for kitty windows.
Note that not all Wayland compositors support the `protocol needed <https://wayland.app/protocols/xdg-toplevel-icon-v1>`__
for changing window icons.

Unfortunately, on macOS, Apple's Dock does not change its cached icon so the
custom icon will revert when kitty is quit. Run the following to force the Dock
to update its cached icons:

.. code-block:: sh

    rm /var/folders/*/*/*/com.apple.dock.iconcache; killall Dock

If you prefer not to keep a custom icon in the kitty config folder, on macOS, you can
also set it with the following command:

.. code-block:: sh

    # Set kitty.icns as the icon for currently running kitty
    kitty +runpy 'from kitty.fast_data_types import cocoa_set_app_icon; import sys; cocoa_set_app_icon(*sys.argv[1:]); print("OK")' kitty.icns

    # Set the icon for app bundle specified by the path
    kitty +runpy 'from kitty.fast_data_types import cocoa_set_app_icon; import sys; cocoa_set_app_icon(*sys.argv[1:]); print("OK")' /path/to/icon.png /Applications/kitty.app

You can also change the icon manually by following the steps:

.. tab:: macOS

    #. Find :file:`kitty.app` in the Applications folder, select it and press :kbd:`⌘+I`
    #. Drag :file:`kitty.icns` onto the application icon in the kitty info pane
    #. Delete the icon cache and restart Dock::

        rm /var/folders/*/*/*/com.apple.dock.iconcache; killall Dock

.. tab:: Linux

   #. Copy :file:`kitty.desktop` from the installation location (usually
      :file:`/usr/share/applications` to :file:`~/.local/share/applications`
   #. Edit the copied desktop file changing the ``Icon`` line to have
      the absolute path to your desired icon.


How do I map key presses in kitty to different keys in the terminal program?
--------------------------------------------------------------------------------------

This is accomplished by using ``map`` with :ac:`send_key` in :file:`kitty.conf`.
For example::

    map alt+s send_key ctrl+s
    map ctrl+alt+2 combine : send_key ctrl+c : send_key h : send_key a

This causes the program running in kitty to receive the :kbd:`ctrl+s` key when
you press the :kbd:`alt+s` key and several keystrokes when you press
:kbd:`ctrl+alt+2`. To see this in action, run::

    kitten show-key -m kitty

Which will print out what key events it receives. To send arbitrary text rather
than a key press, see :sc:`send_text <send_text>` instead.


How do I open a new window or tab with the same working directory as the current window?
--------------------------------------------------------------------------------------------

In :file:`kitty.conf` add the following::

    map f1 launch --cwd=current
    map f2 launch --cwd=current --type=tab

Pressing :kbd:`F1` will open a new kitty window with the same working directory
as the current window. The :doc:`launch command <launch>` is very powerful,
explore :doc:`its documentation <launch>`.


Things behave differently when running kitty from system launcher vs. from another terminal?
-----------------------------------------------------------------------------------------------

This will be because of environment variables. When you run kitty from the
system launcher, it gets a default set of system environment variables. When
you run kitty from another terminal, you are actually running it from a shell,
and the shell's rc files will have setup a whole different set of environment
variables which kitty will now inherit.

You need to make sure that the environment variables you define in your shell's
rc files are either also defined system wide or via the :opt:`env` directive in
:file:`kitty.conf`. Common environment variables that cause issues are those
related to localization, such as :envvar:`LANG`, ``LC_*`` and loading of
configuration files such as ``XDG_*``, :envvar:`KITTY_CONFIG_DIRECTORY` and,
most importantly, ``PATH`` to locate binaries.

The simplest way to fix this is to have kitty load the environment variables
from your shell configuration at startup using the :opt:`env` directive,
adding the following to :file:`kitty.conf`::

    env read_from_shell=PATH LANG LC_* XDG_* EDITOR VISUAL

This works for POSIX compliant shells and the fish shell. Note that it
does add significantly to kitty startup time, so use only if really necessary.
This feature was added in version ``0.43.2``.

To see the environment variables that kitty sees, you can add the following
mapping to :file:`kitty.conf`::

    map f1 show_kitty_env_vars

then pressing :kbd:`F1` will show you the environment variables kitty sees.

This problem is most common on macOS, as Apple makes it exceedingly difficult to
setup environment variables system-wide, so people end up putting them in all
sorts of places where they may or may not work.


I am using tmux/zellij and have a problem
----------------------------------------------

First, terminal multiplexers are :iss:`a bad idea <391#issuecomment-638320745>`,
do not use them, if at all possible. kitty contains features that do all of what
tmux does, but better, with the exception of remote persistence (:iss:`391`).
If you still want to use tmux, read on.

Using ancient versions of tmux such as 1.8 will cause gibberish on screen when
pressing keys (:iss:`3541`).

If you are using tmux with multiple terminals or you start it under one terminal
and then switch to another and these terminals have different :envvar:`TERM`
variables, tmux will break. You will need to restart it as tmux does not support
multiple terminfo definitions.

Displaying images while inside programs such as nvim or ranger may not work
depending on whether those programs have adopted support for the :ref:`unicode
placeholders <graphics_unicode_placeholders>` workaround that kitty created
for tmux refusing to support images.

If you use any of the advanced features that kitty has innovated, such as
:doc:`styled underlines </underlines>`, :doc:`desktop notifications
</desktop-notifications>`, :doc:`variable sized text </text-sizing-protocol>`,
:doc:`extended keyboard support </keyboard-protocol>`,
:doc:`file transfer </kittens/transfer>`, :doc:`the ssh kitten </kittens/ssh>`,
:doc:`shell integration </shell-integration>` etc. they may or may not work,
depending on the whims of tmux's maintainer, your version of tmux, etc.


I opened and closed a lot of windows/tabs and top shows kitty's memory usage is very high?
-------------------------------------------------------------------------------------------

:program:`top` is not a good way to measure process memory usage. That is
because on modern systems, when allocating memory to a process, the C library
functions will typically allocate memory in large blocks, and give the process
chunks of these blocks. When the process frees a chunk, the C library will not
necessarily release the underlying block back to the OS. So even though the
application has released the memory, :program:`top` will still claim the process
is using it.

To check for memory leaks, instead use a tool like `Valgrind
<https://valgrind.org/>`__. Run::

    PYTHONMALLOC=malloc valgrind --tool=massif kitty

Now open lots of tabs/windows, generate lots of output using tools like find/yes
etc. Then close all but one window. Do some random work for a few seconds in
that window, maybe run yes or find again. Then quit kitty and run::

    massif-visualizer massif.out.*

You will see the allocations graph goes up when you opened the windows, then
goes back down when you closed them, indicating there were no memory leaks.

For those interested, you can get a similar profile out of :program:`valgrind`
as you get with :program:`top` by adding ``--pages-as-heap=yes`` then you will
see that memory allocated in malloc is not freed in free. This can be further
refined if you use ``glibc`` as your C library by setting the environment
variable ``MALLOC_MMAP_THRESHOLD_=64``. This will cause free to actually free
memory allocated in sizes of more than 64 bytes. With this set, memory usage
will climb high, then fall when closing windows, but not fall all the way back.
The remaining used memory can be investigated using valgrind again, and it will
come from arenas in the GPU drivers and the per thread arenas glibc's malloc
maintains. These too allocate memory in large blocks and don't release it back
to the OS immediately.


Why does kitty sometimes start slowly on my Linux system?
-------------------------------------------------------------------------------------------

|kitty| takes no longer (within 100ms) to start than other similar GPU terminal
emulators, (and may be faster than some). If |kitty| occasionally takes a long
time to start, it could be a power management issue with the graphics card. On
a multi-GPU system (which many modern laptops are, having a power efficient GPU
that's built into the processor and a power hungry dedicated one that's usually
off), even if the answer of the GPU will only be "don't use me".

For example, if you have a system with an AMD CPU and an NVIDIA GPU, and you
know that you want to use the lower powered card to save battery life and
because kitty does not require a powerful GPU to function, you can choose not
to wake up the dedicated card, which has been reported on at least one system
(:iss:`4292`) to take ≈2 seconds, by running |kitty| as::

    MESA_LOADER_DRIVER_OVERRIDE=radeonsi __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json kitty

The correct command will depend on your situation and hardware.
``__EGL_VENDOR_LIBRARY_FILENAMES`` instructs the GL dispatch library to use
:file:`libEGL_mesa.so` and ignore :file:`libEGL_nvidia.so` also available on the
system, which will wake the NVIDIA card during device enumeration.
``MESA_LOADER_DRIVER_OVERRIDE`` also assures that Mesa won't offer any NVIDIA
card during enumeration, and will instead just use :file:`radeonsi_dri.so`.
```

## File: docs/file-transfer-protocol.rst
```rst
File transfer over the TTY
===============================

There are sometimes situations where the TTY is the only convenient pipe
between two connected systems, for example, nested SSH sessions, a serial
line, etc. In such scenarios, it is useful to be able to transfer files
over the TTY.

This protocol provides the ability to transfer regular files, directories and
links (both symbolic and hard) preserving most of their metadata. It can
optionally use compression and transmit only binary diffs to speed up
transfers. However, since all data is base64 encoded for transmission over the
TTY, this protocol will never be competitive with more direct file transfer
mechanisms.

Overall design
----------------

The basic design of this protocol is around transfer "sessions". Since
untrusted software should not be able to read/write to another machines
filesystem, a session must be approved by the user in the terminal emulator
before any actual data is transmitted, unless a :ref:`pre-shared password is
provided <bypass_auth>`.

There can be either send or receive sessions. In send sessions files are sent
from remote client to the terminal emulator and vice versa for receive sessions.
Every session basically consists of sending metadata for the files first and
then sending the actual data. The session is a series of commands, every command
carrying the session id (which should be a random unique-ish identifier, to
avoid conflicts). The session is bi-directional with commands going both to and
from the terminal emulator. Every command in a session also carries an
``action`` field that specifies what the command does. The remaining fields in
the command are dependent on the nature of the command.

Let's look at some simple examples of sessions to get a feel for the protocol.


Sending files to the computer running the terminal emulator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The client starts by sending a start send command::

    → action=send id=someid

It then waits for a status message from the terminal either
allowing the transfer or refusing it. Until this message is received
the client is not allowed to send any more commands for the session.
The terminal emulator should drop a session if it receives any commands
before sending an ``OK`` response. If the user accepts the transfer,
the terminal will send::

    ← action=status id=someid status=OK

Or if the transfer is refused::

    ← action=status id=someid status=EPERM:User refused the transfer

The client then sends one or more ``file`` commands with the metadata of the file it wants
to transfer::

    → action=file id=someid file_id=f1 name=/path/to/destination
    → action=file id=someid file_id=f2 name=/path/to/destination2 ftype=directory

The terminal responds with either ``OK`` for directories or ``STARTED`` for
files::

    ← action=status id=someid file_id=f1 status=STARTED
    ← action=status id=someid file_id=f2 status=OK

If there was an error with the file, for example, if the terminal does not have
permission to write to the specified location, it will instead respond with an
error, such as::

    ← action=status id=someid file_id=f1 status=EPERM:No permission

The client sends data for files using ``data`` commands. It does not need to
wait for the ``STARTED`` from the terminal for this, the terminal must discard data
for files that are not ``STARTED``. Data for a file is sent in individual
chunks of no larger than ``4096`` bytes. For example::


    → action=data id=someid file_id=f1 data=chunk of bytes
    → action=data id=someid file_id=f1 data=chunk of bytes
    ...
    → action=end_data id=someid file_id=f1 data=chunk of bytes

The sequence of data transmission for a file is ended with an ``end_data``
command. After each data packet is received the terminal replies with
an acknowledgement of the form::

    ← action=status id=someid file_id=f1 status=PROGRESS size=bytes written

After ``end_data`` the terminal replies with::

    ← action=status id=someid file_id=f1 status=OK size=bytes written

If an error occurs while writing the data, the terminal replies with an error
code and ignores further commands about that file, for example::

    ← action=status id=someid file_id=f1 status=EIO:Failed to write to file

Once the client has finished sending as many files as it wants to, it ends
the session with::

    → action=finish id=someid

At this point the terminal commits the session, applying file metadata,
creating links, etc. If any errors occur it responds with an error message,
such as::

    ← action=status id=someid status=Some error occurred


Receiving files from the computer running terminal emulator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The client starts by sending a start receive command::

    → action=receive id=someid size=num_of_paths

It then sends a list of ``num_of_paths`` paths it is interested in
receiving::

    → action=file id=someid file_id=f1 name=/some/path
    → action=file id=someid file_id=f2 name=/some/path2
    ...

The client must then wait for responses from the terminal emulator. It
is an error to send anymore commands to the terminal until an ``OK``
response is received from the terminal. The terminal waits for the user to accept
the request. If accepted, it sends::

    ← action=status id=someid status=OK

If permission is denied it sends::

    ← action=status id=someid status=EPERM:User refused the transfer

The terminal then sends the metadata for all requested files. If any of them
are directories, it traverses the directories recursively, listing all files.
Note that symlinks must not be followed, but sent as symlinks::

    ← action=file id=someid file_id=f1 mtime=XXX permissions=XXX name=/absolute/path status=file_id1 size=size_in_bytes file_type=type parent=file_id of parent
    ← action=file id=someid file_id=f1 mtime=XXX permissions=XXX name=/absolute/path2 status=file_id2 size=size_in_bytes file_type=type parent=file_id of parent
    ...

Here the ``file_id`` field is set to the ``file_id`` value sent from the client
and the ``status`` field is set to the actual file id for each file. This is
because a file query sent from the client can result in multiple actual files if
it is a directory. The ``parent`` field is the actual ``file_id`` of the directory
containing this file and is set for entries that are generated from client
requests that match directories. This allows the client to build an unambiguous picture
of the file tree.

Once all the files are listed, the terminal sends an ``OK`` response that also
specifies the absolute path to the home directory for the user account running
the terminal::

    ← action=status id=someid status=OK name=/path/to/home

If an error occurs while listing any of the files asked for by the client,
the terminal will send an error response like::

    ← action=status id=someid file_id=f1 status=ENOENT: Does not exist

Here, ``file_id`` is the same as was sent by the client in its initial query.

Now, the client can send requests for file data using the paths sent by the
terminal emulator::

    → action=file id=someid file_id=f1 name=/some/path
    ...

The client must not send requests for directories and absolute symlinks.
The terminal emulator replies with the data for the files, as a sequence of
``data`` commands each with a chunk of data no larger than ``4096`` bytes,
for each file (the terminal emulator must send the data for
one file at a time)::


    ← action=data id=someid file_id=f1 data=chunk of bytes
    ...
    ← action=end_data id=someid file_id=f1 data=chunk of bytes

If any errors occur reading file data, the terminal emulator sends an error
message for the file, for example::

    ← action=status id=someid file_id=f1 status=EIO:Could not read

Once the client is done reading data for all the files it expects, it
terminates the session with::

    → action=finished id=someid

Canceling a session
----------------------

A client can decide to cancel a session at any time (for example if the user
presses :kbd:`ctrl+c`). To cancel a session it sends a ``cancel`` action to the
terminal emulator::

    → action=cancel id=someid

The terminal emulator drops the session and sends a cancel acknowledgement::

    ← action=status id=someid status=CANCELED

The client **must** wait for the canceled response from the emulator discarding
any other responses till the cancel is received. If it does not wait, after
it quits the responses might end up being printed to screen.

Quieting responses from the terminal
-------------------------------------

The above protocol includes lots of messages from the terminal acknowledging
receipt of data, granting permission etc., acknowledging cancel requests, etc.
For extremely simple clients like shell scripts, it might be useful to suppress
these responses, which can be done by adding the ``quiet`` key to the start
session command::

    → action=send id=someid quiet=1

The key can take the values ``1`` - meaning suppress acknowledgement responses
or ``2`` - meaning suppress all responses including errors. Only actual data
responses are sent. Note that in particular this means acknowledgement of
permission for the transfer to go ahead is suppressed, so this is typically
useful only with :ref:`bypass_auth`.

.. _file_metadata:

File metadata
-----------------

File metadata includes file paths, permissions and modification times. They are
somewhat tricky as different operating systems support different kinds of
metadata. This specification defines a common minimum set which should work
across most operating systems.

File paths
    File paths must be valid UTF-8 encoded POSIX paths (i.e. using the forward slash
    ``/`` as a separator). Linux systems allow non UTF-8 file paths, these
    are not supported. A leading ``~/`` means a path is relative to the
    ``HOME`` directory. All path must be either absolute (i.e. with a leading
    ``/``) or relative to the HOME directory. Individual components of the
    path must be no longer than 255 UTF-8 bytes. Total path length must be no
    more than 4096 bytes. Paths from Windows systems must use the forward slash
    as the separator, the first path component must be the drive letter with a
    colon. For example: :file:`C:\\some\\file.txt` is represented as
    :file:`/C:/some/file.txt`. For maximum portability, the following
    characters *should* be omitted from paths (however implementations are free
    to try to support them returning errors for non-representable paths)::

        \ * : < > ? | /

File modification times
    Must be represented as the number of nanoseconds since the UNIX epoch. An
    individual file system may not store file metadata with this level of
    accuracy in which case it should use the closest possible approximation.

File permissions
    Represented as a number with the usual UNIX read, write and execute bits.
    In addition, the sticky, set-group-id and set-user-id bits may be present.
    Implementations should make a best effort to preserve as many bits as
    possible. On Windows, there is only a read-only bit. When reading file
    metadata all the ``WRITE`` bits should be set if the read only bit is clear
    and cleared if it is set. When writing files, the read-only bit should be
    set if the bit indicating write permission for the user is clear. The other
    UNIX bits must be ignored when writing. When reading, all the ``READ`` bits
    should always be set and all the ``EXECUTE`` bits should be set if the file is
    directly executable by the Windows Operating system. There is no attempt to
    map Window's ACLs to permission bits.


Symbolic and hard links
---------------------------

Symbolic and hard links can be preserved by this protocol.

.. note::
   In the following when target paths of symlinks are sent as actual paths, they must be
   encoded in the same way as discussed in :ref:`file_metadata`. It is up to
   the receiving side to translate them into appropriate paths for the local
   operating system. This may not always be possible, in which case either the
   symlink should not be created or a broken symlink should be created.


Sending links to the terminal emulator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When sending files to the terminal emulator, the file command has the form::

    → action=file id=someid file_id=f1 name=/path/to/link file_type=link
    → action=file id=someid file_id=f2 name=/path/to/symlink file_type=symlink

Then, when the client is sending data for the files, for hardlinks, the data
will be the ``file_id`` of the target file (assuming the target file is also
being transmitted, otherwise the hard link should be transmitted as a plain
file)::

    → action=end_data id=someid file_id=f1 data=target_file_id_encoded_as_utf8

For symbolic links, the data is a little more complex. If the symbolic link is
to a destination being transmitted, the data has the form::

    → action=end_data id=someid file_id=f1 data=fid:target_file_id_encoded_as_utf8
    → action=end_data id=someid file_id=f1 data=fid_abs:target_file_id_encoded_as_utf8

The ``fid_abs`` form is used if the symlink uses an absolute path, ``fid`` if
it uses a relative path. If the symlink is to a destination that is not being
transmitted, then the prefix ``path:`` and the actual path in the symlink is
transmitted.

Receiving links from the terminal emulator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When receiving files from the terminal emulator, link data is transmitted in
two parts. First when the emulator sends the initial file listing to the
client, the ``file_type`` is set to the link type and the ``data`` field is set
to file_id of the target file if the target file is included in the listing.
For example::

    ← action=file id=someid file_id=f1 status=file_id1 ...
    ← action=file id=someid file_id=f1 status=file_id2 file_type=symlink data=file_id1 ...

Here the rest of the metadata has been left out for clarity. Notice that the
second file is symlink whose ``data`` field is set to the file id of the first
file (the value of the ``status`` field of the first file). The same technique
is used for hard links.

The client should not request data for hard links, instead creating them
directly after transmission is complete. For symbolic links the terminal
must send the actual symbolic link target as a UTF-8 encoded path in the
data field. The client can use this path either as-is (when the target is not
a transmitted file) or to decide whether to create the symlink with a relative
or absolute path when the target is a transmitted file.


Transmitting binary deltas
-----------------------------

Repeated transfer of large files that have only changed a little between
the receiving and sending side can be sped up significantly by transmitting
binary deltas of only the changed portions. This protocol has built-in support
for doing that. This support uses the `rsync algorithm
<https://rsync.samba.org/tech_report/tech_report.html>`__. In this algorithm, first the
receiving side sends a file signature that contains hashes of blocks
in the file. Then the sending side sends only those blocks that have changed.
The receiving side applies these deltas to the file to update it till it matches
the file on the sending side.

The modification to the basic protocol consists of setting the
``transmission_type`` key to ``rsync`` when requesting a file. This triggers
transmission of signatures and deltas instead of file data. The details are
different for sending and receiving.

Sending to the terminal emulator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When sending the metadata of the file it wants to transfer, the client adds the
``transmission_type`` key::

    → action=file id=someid file_id=f1 name=/path/to/destination transmission_type=rsync

The ``STARTED`` response from the terminal will have ``transmission_type`` set
to ``rsync`` if the file exists and the terminal is able to send signature data::

    ← action=status id=someid file_id=f1 status=STARTED transmission_type=rsync

The terminal then transmits the signature using ``data`` commands::

    ← action=data id=someid file_id=f1 data=...
    ...
    ← action=end_data id=someid file_id=f1 data=...

Once the client receives and processes the full signature, it transmits the
file delta to the terminal as ``data`` commands::

    → action=data id=someid file_id=f1 data=...
    → action=data id=someid file_id=f1 data=...
    ...
    → action=end_data id=someid file_id=f1 data=...

The terminal then uses this delta to update the file.

Receiving from the terminal emulator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When the client requests file data from the terminal emulator, it can
add the ``transmission_type=rsync`` key to indicate it will be sending
a signature for that file::

    → action=file id=someid file_id=f1 name=/some/path transmission_type=rsync

The client then sends the signature using ``data`` commands::

    → action=data id=someid file_id=f1 data=...
    ...
    → action=end_data id=someid file_id=f1 data=...

After receiving the signature the terminal replies with the delta as a series
of ``data`` commands::

    ← action=data id=someid file_id=f1 data=...
    ...
    ← action=end_data id=someid file_id=f1 data=...

The client then uses this delta to update the file.

The format of signatures and deltas
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

In what follows, all integers must be encoded in little-endian format,
regardless of the architecture of the machines involved. The XXH3 hash family
refers to `the xxHash algorithm
<https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md>`__.

A signature first has a 12 byte header of the form:

.. code::

    uint16 version
    uint16 checksum_type
    uint16 strong_hash_type
    uint16 weak_hash_type
    uint32 block_size

These fields define the parameters to the rsync algorithm. Allowed values are
currently all zero except for ``block_size``, which is usually the square root
of the file size, but implementations are free to use any algorithm they like
to arrive at the block size.

``checksum_type`` must be ``0`` which indicates using the XXH3-128 bit hash
to verify file integrity after transmission.

``strong_hash_type`` must be ``0`` which indicates using the XXH3-64 bit hash
to identify blocks.

``weak_hash_type`` must be ``0`` which indicates using the `rsync rolling
checksum hash <https://rsync.samba.org/tech_report/node3.html>`__ to identify
blocks, weakly.

After the header comes the list of block signatures. The number of blocks is
unknown allowing for streaming, the transfer protocol takes care of indicating
end-of-stream via an ``action=end_data`` packet. Each signature in the list is of the form:

.. code::

   uint64 index
   uint32 weak_hash
   uint64 strong_hash

Here, ``index`` is the zero-based block number. ``weak_hash`` is the weak, but easy
to calculate hash of the block and strong hash is a stronger hash of the block
that is very unlikely to collide.

The algorithms used for these hashes are specified by the signature header
above. Given the ``block_size`` from the header and ``index`` the position of a
block in the file is: ``index * block_size``.

Once the sending side receives the signature, it calculates a *delta* based on
the actual file contents and transmits that delta to the receiving side. The delta
is of the form of a list of *operations*. An operation is a single byte
denoting the operation type followed by variable length data depending on the
type. The types of operations are:

``Block (type=0)``
    Followed by an 8 byte ``uint64`` that is the block index. It means copy the
    specified block from the existing file to the output, unmodified.

``Data (type=1)``
    Followed by a 4 byte ``uint32`` that is the size of the payload and then the
    payload itself. The payload must be written to the output.

``Hash (type=2)``
    Followed by a 2 byte ``uint16`` specifying the size of the hash checksum and
    then the checksum itself. The checksum of the output file must match this
    checksum. The algorithm used to calculate the checksum is specified in the
    signature header.

``BlockRange (type=3)``
    Followed by an 8 byte ``uint64`` that is the starting block index and then
    a 4 byte ``uint32`` (``N``) that is the number of additional blocks. Works just
    like ``Block`` above, except that after copying the block an additional (``N``) more
    blocks must be copied.


Compression
--------------

Individual files can be transmitted compressed if needed.
Currently, only :rfc:`1950` ZLIB based deflate compression is
supported, which is specified using the ``compression=zlib`` key when
requesting a file. For example when sending files to the terminal emulator,
when sending the file metadata the ``compression`` key can also be
specified::

    → action=file id=someid file_id=f1 name=/path/to/destination compression=zlib

Similarly when receiving files from the terminal emulator, the final file
command that the client sends to the terminal requesting the start of the
transfer of data for the file can include the ``compression`` key::

    → action=file id=someid file_id=f1 name=/some/path compression=zlib

.. _bypass_auth:

Bypassing explicit user authorization
------------------------------------------

In order to bypass the requirement of interactive user authentication,
this protocol has the ability to use a pre-shared secret (password).
When initiating a transfer session the client sends a hash of the password and
the session id::

    → action=send id=someid bypass=sha256:hash_value

For example, suppose that the session id is ``mysession`` and the
shared secret is ``mypassword``. Then the value of the ``bypass``
key above is ``sha256:SHA256("mysession" + ";" + "mypassword")``, which
is::

    → action=send id=mysession bypass=sha256:192bd215915eeaa8c2b2a4c0f8f851826497d12b30036d8b5b1b4fc4411caf2c

The value of ``bypass`` is of the form ``hash_function_name : hash_value``
(without spaces). Currently, only the SHA256 hash function is supported.

.. warning::
   Hashing does not effectively hide the value of the password. So this
   functionality should only be used in secure/trusted contexts. While there
   exist hash functions harder to compute than SHA256, they are unsuitable as
   they will introduce a lot of latency to starting a session and in any case
   there is no mathematical proof that **any** hash function is not brute-forceable.

Terminal implementations are free to use their own more advanced hashing
schemes, with prefixes other than those starting with ``sha``, which are
reserved. For instance, kitty uses a scheme based on public key encryption
via :envvar:`KITTY_PUBLIC_KEY`. For details of this scheme, see the
``check_bypass()`` function in the kitty source code.

Encoding of transfer commands as escape codes
------------------------------------------------

Transfer commands are encoded as ``OSC`` escape codes of the form::

    <OSC> 5113 ; key=value ; key=value ... <ST>

Here ``OSC`` is the bytes ``0x1b 0x5d`` and ``ST`` is the bytes
``0x1b 0x5c``. Keys are words containing only the characters ``[a-zA-Z0-9_]``
and ``value`` is arbitrary data, whose encoding is dependent on the value of
``key``. Unknown keys **must** be ignored when decoding a command.
The number ``5113`` is a constant and is unused by any known OSC codes. It is
the numeralization of the word ``file``.


.. table:: The keys and value types for this protocol
    :align: left

    ================= ======== ============== =======================================================================
    Key               Key name Value type     Notes
    ================= ======== ============== =======================================================================
    action            ac       enum           send, file, data, end_data, receive, cancel, status, finish
    compression       zip      enum           none, zlib
    file_type         ft       enum           regular, directory, symlink, link
    transmission_type tt       enum           simple, rsync
    id                id       safe_string    A unique-ish value, to avoid collisions
    file_id           fid      safe_string    Must be unique per file in a session
    bypass            pw       safe_string    hash of the bypass password and the session id
    quiet             q        integer        0 - verbose, 1 - only errors, 2 - totally silent
    mtime             mod      integer        the modification time of file in nanoseconds since the UNIX epoch
    permissions       prm      integer        the UNIX file permissions bits
    size              sz       integer        size in bytes
    name              n        base64_string  The path to a file
    status            st       base64_string  Status messages
    parent            pr       safe_string    The file id of the parent directory
    data              d        base64_bytes   Binary data
    ================= ======== ============== =======================================================================

The ``Key name`` is the actual serialized name of the key sent in the escape
code. So for example, ``permissions=123`` is serialized as ``prm=123``. This
is done to reduce overhead.

The value types are:

enum
    One from a permitted set of values, for example::

        ac=file

safe_string
    A string consisting only of characters from the set ``[0-9a-zA-Z_:./@-]``
    Note that the semi-colon is missing from this set.

integer
    A base-10 number composed of the characters ``[0-9]`` with a possible
    leading ``-`` sign. When missing the value is zero.

base64_string
    A base64 encoded UTF-8 string using the standard base64 encoding

base64_bytes
    Binary data encoded using the standard base64 encoding


An example of serializing an escape code is shown below::

    action=send id=test name=somefile size=3 data=01 02 03

becomes::

    <OSC> 5113 ; ac=send ; id=test ; n=c29tZWZpbGU= ; sz=3 ; d=AQID <ST>

Here ``c29tZWZpbGU`` is the base64 encoded form of somefile and ``AQID`` is the
base64 encoded form of the bytes ``0x01 0x02 0x03``. The spaces in the encoded
form are present for clarity and should be ignored.
```

## File: docs/glossary.rst
```rst
:orphan:

Glossary
=========

.. glossary::

   os_window
     kitty has two kinds of windows. Operating System windows, referred to as :term:`OS
     Window <os_window>`, and *kitty windows*. An OS Window consists of one or more kitty
     :term:`tabs <tab>`. Each tab in turn consists of one or more *kitty
     windows* organized in a :term:`layout`.

   tab
     A *tab* refers to a group of :term:`kitty windows <window>`, organized in
     a :term:`layout`. Every :term:`OS Window <os_window>` contains one or more tabs.

   layout
     A *layout* is a system of organizing :term:`kitty windows <window>` in
     groups inside a tab. The layout automatically maintains the size and
     position of the windows, think of a layout as a tiling window manager for
     the terminal. See :doc:`layouts` for details.

   window
     kitty has two kinds of windows. Operating System windows, referred to as :term:`OS
     Window <os_window>`, and *kitty windows*. An OS Window consists of one or more kitty
     :term:`tabs <tab>`. Each tab in turn consists of one or more *kitty
     windows* organized in a :term:`layout`.

   overlay
      An *overlay window* is a :term:`kitty window <window>` that is placed on
      top of an existing kitty window, entirely covering it. Overlays are used
      throughout kitty, for example, to display the :ref:`the scrollback buffer <scrollback>`,
      to display :doc:`hints </kittens/hints>`, for :doc:`unicode input
      </kittens/unicode_input>` etc. Normal overlays are meant for short
      duration popups and so are not considered the :italic:`active window`
      when determining the current working directory or getting input text for
      kittens, launch commands, etc. To create an overlay considered as a
      :italic:`main window` use the :code:`overlay-main` argument to
      :doc:`launch`.

   hyperlinks
      Terminals can have hyperlinks, just like the internet. In kitty you can
      :doc:`control exactly what happens <open_actions>` when clicking on a
      hyperlink, based on the type of link and its URL. See also `Hyperlinks in terminal
      emulators <https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda>`__.

   kittens
      Small, independent statically compiled command line programs that are designed to run
      inside kitty windows and provide it with lots of powerful and flexible
      features such as viewing images, connecting conveniently to remote
      computers, transferring files, inputting unicode characters, etc.
      They can also be written by users in Python and used to customize and
      extend kitty functionality, see :doc:`kittens_intro` for details.

   easing function
      A function that controls how an animation progresses over time. kitty
      support the `CSS syntax for easing functions
      <https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function>`__.
      Commonly used easing functions are :code:`linear` for a constant rate
      animation and :code:`ease-in-out` for an animation that starts slow,
      becomes fast in the middle and ends slowly. These are used to control
      various animations in kitty, such as :opt:`cursor_blink_interval` and
      :opt:`visual_bell_duration`.

.. _env_vars:

Environment variables
------------------------

Variables that influence kitty behavior
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. envvar:: KITTY_CONFIG_DIRECTORY

   Controls where kitty looks for :file:`kitty.conf` and other configuration
   files. Defaults to :file:`~/.config/kitty`. For full details of the config
   directory lookup mechanism see, :option:`kitty --config`.

.. envvar:: KITTY_CACHE_DIRECTORY

   Controls where kitty stores cache files. Defaults to :file:`~/.cache/kitty`
   or :file:`~/Library/Caches/kitty` on macOS.

.. envvar:: KITTY_RUNTIME_DIRECTORY

   Controls where kitty stores runtime files like sockets. Defaults to
   the :code:`XDG_RUNTIME_DIR` environment variable if that is defined
   otherwise the run directory inside the kitty cache directory is used.

.. envvar:: VISUAL

   The terminal based text editor (such as :program:`vi` or :program:`nano`)
   kitty uses, when, for instance, opening :file:`kitty.conf` in response to
   :sc:`edit_config_file`.

.. envvar:: EDITOR

   Same as :envvar:`VISUAL`. Used if :envvar:`VISUAL` is not set.

.. envvar:: SHELL

   Specifies the default shell kitty will run when :opt:`shell` is set to
   :code:`.`.

.. envvar:: GLFW_IM_MODULE

   Set this to ``ibus`` to enable support for IME under X11.

.. envvar:: KITTY_WAYLAND_DETECT_MODIFIERS

   When set to a non-empty value, kitty attempts to autodiscover XKB modifiers
   under Wayland. This is useful if using non-standard modifiers like hyper. It
   is possible for the autodiscovery to fail; the default Wayland XKB mappings
   are used in this case. See :pull:`3943` for details.

.. envvar:: SSH_ASKPASS

   Specify the program for SSH to ask for passwords. When this is set, :doc:`ssh
   kitten </kittens/ssh>` will use this environment variable by default. See
   :opt:`askpass <kitten-ssh.askpass>` for details.

.. envvar:: KITTY_CLONE_SOURCE_CODE

   Set this to some shell code that will be executed in the cloned window with
   :code:`eval` when :ref:`clone-in-kitty <clone_shell>` is used.

.. envvar:: KITTY_CLONE_SOURCE_PATH

   Set this to the path of a file that will be sourced in the cloned window when
   :ref:`clone-in-kitty <clone_shell>` is used.

.. envvar:: KITTY_DEVELOP_FROM

   Set this to the directory path of the kitty source code and its Python code
   will be loaded from there. Only works with official binary builds.

.. envvar:: KITTY_RC_PASSWORD

   Set this to a pass phrase to use the ``kitten @`` remote control command with
   :opt:`remote_control_password`.


Variables that kitty sets when running child programs
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. envvar:: LANG

   This is only set on macOS. If the country and language from the macOS user
   settings form an invalid locale, it will be set to :code:`en_US.UTF-8`.

.. envvar:: PATH

   kitty prepends itself to the PATH of its own environment to ensure the
   functions calling :program:`kitty` will work properly.

.. envvar:: KITTY_WINDOW_ID

   An integer that is the id for the kitty :term:`window` the program is running in.
   Can be used with the :doc:`kitty remote control facility <remote-control>`.

.. envvar:: KITTY_PID

   An integer that is the process id for the kitty process in which the program
   is running. Allows programs to tell kitty to reload its config by sending it
   the SIGUSR1 signal.

.. envvar:: KITTY_PUBLIC_KEY

   A public key that programs can use to communicate securely with kitty using
   the remote control protocol. The format is: :code:`protocol:key data`.

.. envvar:: WINDOWID

   The id for the :term:`OS Window <os_window>` the program is running in. Only available
   on platforms that have ids for their windows, such as X11 and macOS.

.. envvar:: TERM

   The name of the terminal, defaults to ``xterm-kitty``. See :opt:`term`.

.. envvar:: TERMINFO

   Path to a directory containing the kitty terminfo database. Or the terminfo
   database itself encoded in base64. See :opt:`terminfo_type`.

.. envvar:: KITTY_INSTALLATION_DIR

   Path to the kitty installation directory.

.. envvar:: COLORTERM

   Set to the value ``truecolor`` to indicate that kitty supports 16 million
   colors.

.. envvar:: KITTY_LISTEN_ON

   Set when the :doc:`remote control <remote-control>` facility is enabled and
   the a socket is used for control via :option:`kitty --listen-on` or :opt:`listen_on`.
   Contains the path to the socket. Avoid the need to use :option:`kitten @ --to` when
   issuing remote control commands. Can also be a file descriptor of the form
   fd:num instead of a socket address, in which case, remote control
   communication should proceed over the specified file descriptor.

.. envvar:: KITTY_PIPE_DATA

   Set to data describing the layout of the screen when running child
   programs using :option:`launch --stdin-source` with the contents of the
   screen/scrollback piped to them.

.. envvar:: KITTY_CHILD_CMDLINE

   Set to the command line of the child process running in the kitty
   window when calling the notification callback program on terminal bell, see
   :opt:`command_on_bell`.

.. envvar:: KITTY_COMMON_OPTS

   Set with the values of some common kitty options when running
   kittens, so kittens can use them without needing to load :file:`kitty.conf`.

.. envvar:: KITTY_SHELL_INTEGRATION

   Set when enabling :ref:`shell_integration`. It is automatically removed by
   the shell integration scripts.

.. envvar:: KITTY_SI_RUN_COMMAND_AT_STARTUP

   Set this to an expression that the kitty shell integration scripts will
   ``eval`` after the shell is started. Note that this environment variable
   is ignored when present in the environment in which kitty itself is launched
   in. It is most useful with the ``--env`` flag for the :doc:`launch <launch>`
   action.

.. envvar:: ZDOTDIR

   Set when enabling :ref:`shell_integration` with :program:`zsh`, allowing
   :program:`zsh` to automatically load the integration script.

.. envvar:: XDG_DATA_DIRS

   Set when enabling :ref:`shell_integration` with :program:`fish`, allowing
   :program:`fish` to automatically load the integration script.

.. envvar:: ENV

   Set when enabling :ref:`shell_integration` with :program:`bash`, allowing
   :program:`bash` to automatically load the integration script.

.. envvar:: KITTY_OS

   Set when using the include directive in kitty.conf. Can take values:
   ``linux``, ``macos``, ``bsd``.

.. envvar:: KITTY_HOLD

   Set to ``1`` when kitty is running a shell because of the ``--hold`` flag. Can
   be used to specialize shell behavior in the shell rc files as desired.

.. envvar:: KITTY_SIMD

   Set it to ``128`` to use 128 bit vector registers, ``256`` to use 256 bit
   vector registers or any other value to prevent kitty from using SIMD CPU
   vector instructions. Warning, this overrides CPU capability detection so
   will cause kitty to crash with SIGILL if your CPU does not support the
   necessary SIMD extensions.
```

## File: docs/graphics-protocol.rst
```rst
Terminal graphics protocol
=================================

The goal of this specification is to create a flexible and performant protocol
that allows the program running in the terminal, hereafter called the *client*,
to render arbitrary pixel (raster) graphics to the screen of the terminal
emulator. The major design goals are:

* Should not require terminal emulators to understand image formats.
* Should allow specifying graphics to be drawn at individual pixel positions.
* The graphics should integrate with the text, in particular it should be possible to draw graphics
  below as well as above the text, with alpha blending. The graphics should also scroll with the text, automatically.
* Should use optimizations when the client is running on the same computer as the terminal emulator.

For some discussion regarding the design choices, see :iss:`33`.

To see a quick demo, inside a |kitty| terminal run::

    kitten icat path/to/some/image.png

You can also see a screenshot with more sophisticated features such as
alpha-blending and text over graphics.

.. image:: https://user-images.githubusercontent.com/1308621/31647475-1188ab66-b326-11e7-8d26-24b937f1c3e8.png
    :alt: Demo of graphics rendering in kitty
    :align: center

Some applications that use the kitty graphics protocol:

* `awrit <https://github.com/chase/awrit>`_ - Chromium-based web browser rendered in Kitty with mouse and keyboard support
* `blackcat <https://github.com/j-c-m/blackcat>`_ - a modern compatible cat with image support
* `broot <https://dystroy.org/broot/>`_ - a terminal file explorer and manager, with preview of images, SVG, PDF, etc.
* `chafa <https://github.com/hpjansson/chafa>`_  - a terminal image viewer
* :doc:`kitty-diff <kittens/diff>` - a side-by-side terminal diff program with support for images
* `fzf <https://github.com/junegunn/fzf/commit/d8188fce7b7bea982e7f9050c35e488e49fb8fd0>`_ - A command line fuzzy finder
* `mpv <https://github.com/mpv-player/mpv/commit/874e28f4a41a916bb567a882063dd2589e9234e1>`_ - A video player that can play videos in the terminal
* `neofetch <https://github.com/dylanaraps/neofetch>`_ - A command line system information tool
* `pixcat <https://github.com/mirukana/pixcat>`_ - a third party CLI and python library that wraps the graphics protocol
* `ranger <https://github.com/ranger/ranger>`_ - a terminal file manager, with image previews
* `termpdf.py <https://github.com/dsanson/termpdf.py>`_ - a terminal PDF/DJVU/CBR viewer
* `timg <https://github.com/hzeller/timg>`_ - a terminal image and video viewer
* `tpix <https://github.com/jesvedberg/tpix>`_ - a statically compiled binary that can be used to display images and easily installed on remote servers without root access
* `twitch-tui <https://github.com/Xithrius/twitch-tui>`_ - Twitch chat in the terminal
* `vat <https://github.com/jzbrooks/vat>`_ - a terminal image viewer for vector graphics, including Android Vector Drawables
* `viu <https://github.com/atanunq/viu>`_ - a terminal image viewer
* `Yazi <https://github.com/sxyazi/yazi>`_ - Blazing fast terminal file manager written in Rust, based on async I/O

Libraries:

* `ctx.graphics <https://ctx.graphics/>`_ - Library for drawing graphics
* `notcurses <https://github.com/dankamongmen/notcurses>`_ - C library for terminal graphics with bindings for C++, Rust and Python
* `rasterm <https://github.com/BourgeoisBear/rasterm>`_  - Go library to display images in the terminal
* `hologram.nvim <https://github.com/edluffy/hologram.nvim>`_  - view images inside nvim
* `image.nvim <https://github.com/3rd/image.nvim>`_ - Bringing images to neovim
* `image_preview.nvim <https://github.com/adelarsq/image_preview.nvim/>`_ - Image preview for neovim
* `kui.nvim <https://github.com/romgrk/kui.nvim>`_  - Build sophisticated UIs inside neovim using the kitty graphics protocol
* `term-image <https://github.com/AnonymouX47/term-image>`_  - A Python library, CLI and TUI to display and browse images in the terminal
* `glkitty <https://github.com/michaeljclark/glkitty>`_ - C library to draw OpenGL shaders in the terminal with a glgears demo

Other terminals that have implemented the graphics protocol:

* `Ghostty <https://ghostty.org>`_
* `Konsole <https://invent.kde.org/utilities/konsole/-/merge_requests/594>`_
* `st (with a patch) <https://st.suckless.org/patches/kitty-graphics-protocol>`_
* `Warp <https://docs.warp.dev/getting-started/changelog#id-2025.03.26-v0.2025.03.26.08.10>`_
* `wayst <https://github.com/91861/wayst>`_
* `WezTerm <https://github.com/wez/wezterm/issues/986>`_
* `iTerm2 <https://github.com/gnachman/iTerm2/commit/4fe5b2173193b6c3e45234b6b2ab7a144a5cfa01>`_


Getting the window size
-------------------------

In order to know what size of images to display and how to position them, the
client must be able to get the window size in pixels and the number of cells
per row and column. The cell width is then simply the window size divided by the
number of rows. This can be done by using the ``TIOCGWINSZ`` ioctl. Some
code to demonstrate its use

.. tab:: C

    .. code-block:: c

        #include <stdio.h>
        #include <sys/ioctl.h>

        int main(int argc, char **argv) {
            struct winsize sz;
            ioctl(0, TIOCGWINSZ, &sz);
            printf(
                "number of rows: %i, number of columns: %i, screen width: %i, screen height: %i\n",
                sz.ws_row, sz.ws_col, sz.ws_xpixel, sz.ws_ypixel);
            return 0;
        }


.. tab:: Python

    .. code-block:: python

        import array, fcntl, sys, termios
        buf = array.array('H', [0, 0, 0, 0])
        fcntl.ioctl(sys.stdout, termios.TIOCGWINSZ, buf)
        print((
            'number of rows: {} number of columns: {} '
            'screen width: {} screen height: {}').format(*buf))

.. tab:: Go

    .. code-block:: go

        package main

        import (
            "fmt"
            "os"

            "golang.org/x/sys/unix"
        )

        func main() {
            var err error
            var f *os.File
            if f, err = os.OpenFile("/dev/tty", unix.O_NOCTTY|unix.O_CLOEXEC|unix.O_NDELAY|unix.O_RDWR, 0666); err == nil {
                var sz *unix.Winsize
                if sz, err = unix.IoctlGetWinsize(int(f.Fd()), unix.TIOCGWINSZ); err == nil {
                    fmt.Printf("rows: %v columns: %v width: %v height %v\n", sz.Row, sz.Col, sz.Xpixel, sz.Ypixel)
                    return
                }
            }
            fmt.Fprintln(os.Stderr, err)
            os.Exit(1)
        }


.. tab:: POSIX sh

    .. code-block:: sh

        #!/bin/sh

        read rows cols <<EOF
        $(command stty size)
        EOF

        oldstty=$(command stty -g)
        command stty raw -echo
        printf "\033[14t"
        response=""
        while : ; do
            char=$(command dd bs=1 count=1 2>/dev/null)
            [ "$char" = "t" ] && break
            response="${response}${char}"
        done
        command stty "$oldstty"
        h=$(echo "$response" | cut -d';' -f2)
        w=$(echo "$response" | cut -d';' -f3)
        printf "number of rows: %d number of columns: %d" "$rows" "$cols"
        printf " screen width: %d screen height: %d\n" "$w" "$h"


Note that some terminals return ``0`` for the width and height values. Such
terminals should be modified to return the correct values.  Examples of
terminals that return correct values: ``kitty, xterm``

You can also use the *CSI t* escape code to get the screen size. Send
``<ESC>[14t`` to ``STDOUT`` and kitty will reply on ``STDIN`` with
``<ESC>[4;<height>;<width>t`` where ``height`` and ``width`` are the window
size in pixels. This escape code is supported in many terminals, not just
kitty. A more precise version of this escape code, which is however supported
in less terminals is ``<ESC>[16t`` which causes the terminal to reply with the
pixel dimensions of a single cell.

A minimal example
------------------

Some minimal code to display PNG images in kitty, using the most basic
features of the graphics protocol:

.. tab:: POSIX sh

    .. code-block:: sh

        #!/bin/sh

        send_chunked() {
            first="y"
            while IFS= read -r chunk; do
                metadata=""; [ "$first" = "y" ] && { metadata="a=T,f=100,"; first="n"; }
                printf "\033_G%sm=1;%s\033\\" "${metadata}" "${chunk}"
            done
            [ "$first" = "n" ] && { printf "\033_Gm=0;\033\\"; return 0; }
            return 1
        }

        transmit_png() {
            # Different systems have different or missing base64 executables.
            # The sed command below adds a trailing newline which openssl
            # base64 does not produce and is needed for reading via read -r
            { command base64 -w 4096 "$1" 2>/dev/null | send_chunked; } || \
            { command base64 -b 4096 "$1" 2>/dev/null | send_chunked; } || \
            { command openssl base64 -e -A -in "$1" | command sed '$a\' | command fold -b -w 4096 | send_chunked; }
        }

        transmit_png "$1"


.. tab:: Python

    .. code-block:: python

        #!/usr/bin/env python
        import sys
        from base64 import standard_b64encode

        first, eof, buf = True, False, memoryview(bytearray(3 * 4096 // 4))
        w = sys.stdout.buffer.write
        with open(sys.argv[-1], 'rb') as f:
            while not eof:
                p = buf[:]
                while p and not eof:
                    n = f.readinto1(p)
                    p, eof = p[n:], n == 0
                encoded = standard_b64encode(buf[:len(buf)-len(p)])
                metadata, first = "a=T,f=100," if first else "", False
                w(f'\x1b_G{metadata}m={0 if eof else 1};'.encode('ascii'))
                w(encoded)
                w(b'\x1b\\')


Save this script as :file:`send-png`, then you can use it to display any PNG
file in kitty as::

    chmod +x send-png
    ./send-png file.png


The graphics escape code
---------------------------

All graphics escape codes are of the form::

    <ESC>_G<control data>;<payload><ESC>\

This is a so-called *Application Programming Command (APC)*. Most terminal
emulators ignore APC codes, making it safe to use.

The control data is a comma-separated list of ``key=value`` pairs.  The payload
is arbitrary binary data, :rfc:`base64 <4648>` encoded to prevent interoperation problems
with legacy terminals that get confused by control codes within an APC code.
The meaning of the payload is interpreted based on the control data.

The first step is to transmit the actual image data.

.. _transferring_pixel_data:

Transferring pixel data
--------------------------

The first consideration when transferring data between the client and the
terminal emulator is the format in which to do so. Since there is a vast and
growing number of image formats in existence, it does not make sense to have
every terminal emulator implement support for them. Instead, the client should
send simple pixel data to the terminal emulator. The obvious downside to this
is performance, especially when the client is running on a remote machine.
Techniques for remedying this limitation are discussed later. The terminal
emulator must understand pixel data in three formats, 24-bit RGB, 32-bit RGBA and
PNG. This is specified using the ``f`` key in the control data. ``f=32`` (which is the
default) indicates 32-bit RGBA data and ``f=24`` indicates 24-bit RGB data and ``f=100``
indicates PNG data. The PNG format is supported both for convenience, and as a compact way
of transmitting paletted images.

RGB and RGBA data
~~~~~~~~~~~~~~~~~~~

In these formats the pixel data is stored directly as 3 or 4 bytes per pixel,
respectively. The colors in the data **must** be in the *sRGB color space*.  When
specifying images in this format, the image dimensions **must** be sent in the
control data. For example::

    <ESC>_Gf=24,s=10,v=20;<payload><ESC>\

Here the width and height are specified using the ``s`` and ``v`` keys respectively. Since
``f=24`` there are three bytes per pixel and therefore the pixel data must be ``3 * 10 * 20 = 600``
bytes.

PNG data
~~~~~~~~~~~~~~~

In this format any PNG image can be transmitted directly.  For example::

    <ESC>_Gf=100;<payload><ESC>\


The PNG format is specified using the ``f=100`` key. The width and height of
the image will be read from the PNG data itself. Note that if you use both PNG and
compression, then you must provide the ``S`` key with the size of the PNG data.


Compression
~~~~~~~~~~~~~

The client can send compressed image data to the terminal emulator, by
specifying the ``o`` key. Currently, only :rfc:`1950` ZLIB based deflate
compression is supported, which is specified using ``o=z``. For example::

    <ESC>_Gf=24,s=10,v=20,o=z;<payload><ESC>\

This is the same as the example from the RGB data section, except that the
payload is now compressed using deflate (this occurs prior to
:rfc:`base64 <4648>` encoding).
The terminal emulator will decompress it before rendering. You can specify
compression for any format. The terminal emulator will decompress before
interpreting the pixel data.


The transmission medium
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The transmission medium is specified using the ``t`` key. The ``t`` key defaults to ``d``
and can take the values:

==================    ============
Value of `t`          Meaning
==================    ============
``d``                 Direct (the data is transmitted within the escape code itself)
``f``                 A simple file (regular files only, not named pipes, device files, etc.)
``t``                 A temporary file, the terminal emulator will delete the file after reading the pixel data. For security reasons
                      the terminal emulator should only delete the file if it
                      is in a known temporary directory, such as :file:`/tmp`,
                      :file:`/dev/shm`, :file:`TMPDIR env var if present` and any platform
                      specific temporary directories and the file has the
                      string :code:`tty-graphics-protocol` in its full file path.
``s``                 A *shared memory object*, which on POSIX systems is a
                      `POSIX shared memory object <https://pubs.opengroup.org/onlinepubs/9699919799/functions/shm_open.html>`_
                      and on Windows is a
                      `Named shared memory object <https://docs.microsoft.com/en-us/windows/win32/memory/creating-named-shared-memory>`_.
                      The terminal emulator must read the data from the memory
                      object and then unlink and close it on POSIX and just
                      close it on Windows.
==================    ============

When opening files, the terminal emulator must follow symlinks. In case of
symlink loops or too many symlinks, it should fail and respond with an error,
similar to reporting any other kind of I/O error. Since the file paths come
from potentially untrusted sources, terminal emulators **must** refuse to read
any device/socket/etc. special files. Only regular files are allowed.
Additionally, terminal emulators may refuse to read files in *sensitive*
parts of the filesystem, such as :file:`/proc`, :file:`/sys`, :file:`/dev`, etc.

Local client
^^^^^^^^^^^^^^

First let us consider the local client techniques (files and shared memory). Some examples::

    <ESC>_Gf=100,t=f;<encoded /path/to/file.png><ESC>\

Here we tell the terminal emulator to read PNG data from the specified file of
the specified size::

    <ESC>_Gs=10,v=2,t=s,o=z;<encoded /some-shared-memory-name><ESC>\

Here we tell the terminal emulator to read compressed image data from
the specified shared memory object.

The client can also specify a size and offset to tell the terminal emulator
to only read a part of the specified file. This is done using the ``S`` and ``O``
keys respectively. For example::

    <ESC>_Gs=10,v=2,t=s,S=80,O=10;<encoded /some-shared-memory-name><ESC>\

This tells the terminal emulator to read ``80`` bytes starting from the offset ``10``
inside the specified shared memory buffer.


Remote client
^^^^^^^^^^^^^^^^

Remote clients, those that are unable to use the filesystem/shared memory to
transmit data, must send the pixel data directly using escape codes. Since
escape codes are of limited maximum length, the data will need to be chunked up
for transfer. This is done using the ``m`` key. The pixel data must first be
:rfc:`base64 <4648>` encoded then chunked up into chunks no larger than ``4096`` bytes. All
chunks, except the last, must have a size that is a multiple of 4. The client
then sends the graphics escape code as usual, with the addition of an ``m`` key
that must have the value ``1`` for all but the last chunk, where it must be
``0``. For example, if the data is split into three chunks, the client would
send the following sequence of escape codes to the terminal emulator::

    <ESC>_Gs=100,v=30,m=1;<encoded pixel data first chunk><ESC>\
    <ESC>_Gm=1;<encoded pixel data second chunk><ESC>\
    <ESC>_Gm=0;<encoded pixel data last chunk><ESC>\

Note that only the first escape code needs to have the full set of control
codes such as width, height, format, etc. Subsequent chunks **must** have only
the ``m`` and optionally ``q`` keys. When sending animation frame data, subsequent
chunks **must** also specify the ``a=f`` key. The client **must** finish sending
all chunks for a single image before sending any other graphics related escape
codes. Note that the cursor position used to display the image **must** be the
position when the final chunk is received. Finally, terminals must not display
anything, until the entire sequence is received and validated.


Querying support and available transmission mediums
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Since a client has no a-priori knowledge of whether it shares a filesystem/shared memory
with the terminal emulator, it can send an id with the control data, using the ``i`` key
(which can be an arbitrary positive integer up to 4294967295, it must not be zero).
If it does so, the terminal emulator will reply after trying to load the image, saying
whether loading was successful or not. For example::

    <ESC>_Gi=31,s=10,v=2,t=s;<encoded /some-shared-memory-name><ESC>\

to which the terminal emulator will reply (after trying to load the data)::

    <ESC>_Gi=31;error message or OK<ESC>\

Here the ``i`` value will be the same as was sent by the client in the original
request.  The message data will be a ASCII encoded string containing only
printable characters and spaces. The string will be ``OK`` if reading the pixel
data succeeded or an error message.

Sometimes, using an id is not appropriate, for example, if you do not want to
replace a previously sent image with the same id, or if you are sending a dummy
image and do not want it stored by the terminal emulator. In that case, you can
use the *query action*, set ``a=q``. Then the terminal emulator will try to load
the image and respond with either OK or an error, as above, but it will not
replace an existing image with the same id, nor will it store the image.

We intend that any terminal emulator that wishes to support it can do so. To
check if a terminal emulator supports the graphics protocol the best way is to
send the above *query action* followed by a request for the `primary device
attributes <https://vt100.net/docs/vt510-rm/DA1.html>`_. If you get back an
answer for the device attributes without getting back an answer for the *query
action* the terminal emulator does not support the graphics protocol.

This means that terminal emulators that support the graphics protocol, **must**
reply to *query actions* immediately without processing other input. Most
terminal emulators handle input in a FIFO manner, anyway.

So for example, you could send::

      <ESC>_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA<ESC>\<ESC>[c

If you get back a response to the graphics query, the terminal emulator supports
the protocol, if you get back a response to the device attributes query without
a response to the graphics query, it does not.


Display images on screen
-----------------------------

Every transmitted image can be displayed an arbitrary number of times on the
screen, in different locations, using different parts of the source image, as
needed. Each such display of an image is called a *placement*.  You can either
simultaneously transmit and display an image using the action ``a=T``, or first
transmit the image with a id, such as ``i=10`` and then display it with
``a=p,i=10`` which will display the previously transmitted image at the current
cursor position. When specifying an image id, the terminal emulator will reply
to the placement request with an acknowledgement code, which will be either::

    <ESC>_Gi=<id>;OK<ESC>\

when the image referred to by id was found, or::

    <ESC>_Gi=<id>;ENOENT:<some detailed error msg><ESC>\

when the image with the specified id was not found. This is similar to the
scheme described above for querying available transmission media, except that
here we are querying if the image with the specified id is available or needs to
be re-transmitted.

Since there can be many placements per image, you can also give placements an
id. To do so add the ``p`` key with a number between ``1`` and ``4294967295``.
When you specify a placement id, it will be added to the acknowledgement code
above. Every placement is uniquely identified by the pair of the ``image id``
and the ``placement id``. If you specify a placement id for an image that does
not have an id (i.e. has id=0), it will be ignored, i.e. the placement will not
get an id. In particular this means there can exist multiple images with
``image id=0, placement id=0``. Not specifying a placement id or using ``p=0``
for multiple put commands (``a=p``) with the same non-zero image id results in
multiple placements the image.

An example response::

    <ESC>_Gi=<image id>,p=<placement id>;OK<ESC>\

If you send two placements with the same ``image id`` and ``placement id`` the
second one will replace the first. This can be used to resize or move
placements around the screen, without flicker.


.. note::
   When re-transmitting image data for a specific id, the existing image and
   all its placements must be deleted. The new data replaces the old image data
   but is not actually displayed until a placement for it is created. This is
   to avoid divergent behavior in the case when unrelated programs happen to re-use
   image ids in the same session.


.. versionadded:: 0.19.3
   Support for specifying placement ids (see :doc:`kittens/query_terminal` to query kitty version)


Controlling displayed image layout
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The image is rendered at the current cursor position, from the upper left corner of
the current cell. You can also specify extra ``X=3`` and ``Y=4`` pixel offsets to display from
a different origin within the cell. Note that the offsets must be smaller than the size of the cell.

By default, the entire image will be displayed (images wider than the available
width will be truncated on the right edge). You can choose a source rectangle (in pixels)
as the part of the image to display. This is done with the keys: ``x, y, w, h`` which specify
the top-left corner, width and height of the source rectangle. The displayed
area is the intersection of the specified rectangle with the source image
rectangle.

You can also ask the terminal emulator to display the image in a specified rectangle
(num of columns / num of lines), using the control codes ``c,r``. ``c`` is the number of columns
and `r` the number of rows. The image will be scaled (enlarged/shrunk) as needed to fit
the specified area. Note that if you specify a start cell offset via the ``X,Y`` keys, it is not
added to the number of rows/columns. If only one of either ``r`` or ``c`` is
specified, the other one is computed based on the source image aspect ratio, so
that the image is displayed without distortion.

Finally, you can specify the image *z-index*, i.e. the vertical stacking order. Images
placed in the same location with different z-index values will be blended if
they are semi-transparent. You can specify z-index values using the ``z`` key.
Negative z-index values mean that the images will be drawn under the text. This
allows rendering of text on top of images. Negative z-index values below
INT32_MIN/2 (-1,073,741,824) will be drawn under cells with non-default background
colors. If two images with the same z-index overlap then the image with the
lower id is considered to have the lower z-index. If the images have the same
z-index and the same id, then the behavior is undefined.

.. note:: After placing an image on the screen the cursor must be moved to the
   right by the number of cols in the image placement rectangle and down by the
   number of rows in the image placement rectangle. If either of these cause
   the cursor to leave either the screen or the scroll area, the exact
   positioning of the cursor is undefined, and up to implementations.
   The client can ask the terminal emulator to not move the cursor at all
   by specifying ``C=1`` in the command, which sets the cursor movement policy
   to no movement for placing the current image.

.. versionadded:: 0.20.0
   Support for the C=1 cursor movement policy


.. _graphics_unicode_placeholders:

Unicode placeholders
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 0.28.0
   Support for image display via Unicode placeholders

You can also use a special Unicode character ``U+10EEEE`` as a placeholder for
an image. This approach is less flexible, but it allows using images inside
any host application that supports Unicode, foreground colors (tmux, vim, weechat, etc.),
and a way to pass escape codes through to the underlying terminal.

The central idea is that we use a single *Private Use* Unicode character as a
*placeholder* to indicate to the terminal that an image is supposed to be
displayed at that cell. Since this character is just normal text, Unicode aware
application will move it around as needed when they redraw their screens,
thereby automatically moving the displayed image as well, even though they know
nothing about the graphics protocol. So an image is first created using the
normal graphics protocol escape codes (albeit in quiet mode (``q=2``) so that there are
no responses from the terminal that could confuse the host application). Then,
the actual image is displayed by getting the host application to emit normal
text consisting of ``U+10EEEE`` and various diacritics (Unicode combining
characters) and colors.

To use it, first create an image as you would normally with the graphics
protocol with (``q=2``), but do not create a placement for it, that is, do not
display it. Then, create a *virtual image placement* by specifying ``U=1`` and
the desired number of lines and columns::

    <ESC>_Ga=p,U=1,i=<image_id>,c=<columns>,r=<rows><ESC>\

The creation of the placement need not be a separate escape code, it can be
combined with ``a=T`` to both transmit and create the virtual placement with a
single code.

The image will eventually be fit to the specified rectangle, its aspect ratio
preserved. Finally, the image can be actually displayed by using the
placeholder character, encoding the image ID in its foreground color. The row
and column values are specified with diacritics listed in
:download:`rowcolumn-diacritics.txt <../gen/rowcolumn-diacritics.txt>`.  For
example, here is how you can print a ``2x2`` placeholder for image ID ``42``:

.. code-block:: sh

    printf "\e[38;5;42m\U10EEEE\U0305\U0305\U10EEEE\U0305\U030D\e[39m\n"
    printf "\e[38;5;42m\U10EEEE\U030D\U0305\U10EEEE\U030D\U030D\e[39m\n"

Here, ``U+305`` is the diacritic corresponding to the number ``0``
and ``U+30D`` corresponds to ``1``. So these two commands create the following
``2x2`` placeholder:

========== ==========
(0, 0)     (0, 1)
(1, 0)     (1, 1)
========== ==========

This will cause the image with ID ``42`` to be displayed in a ``2x2`` grid.
Ideally, you would print out as many cells as the number of rows and columns
specified when creating the virtual placement, but in case of a mismatch only
part of the image will be displayed.

By using only the foreground color for image ID you are limited to either 8-bit IDs in 256 color
mode or 24-bit IDs in true color mode. Since IDs are in a global namespace
there can easily be collisions. If you need more bits for the image
ID, you can specify the most significant byte via a third diacritic. For
example, this is the placeholder for the image ID ``33554474 = 42 + (2 << 24)``:

.. code-block:: sh

    printf "\e[38;5;42m\U10EEEE\U0305\U0305\U030E\U10EEEE\U0305\U030D\U030E\n"
    printf "\e[38;5;42m\U10EEEE\U030D\U0305\U030E\U10EEEE\U030D\U030D\U030E\n"

Here, ``U+30E`` is the diacritic corresponding to the number ``2``.

You can also specify a placement ID using the underline color (if it's omitted
or zero, the terminal may choose any virtual placement of the given image). The
background color is interpreted as the background color, visible if the image is
transparent. Other text attributes are reserved for future use.

Row, column and most significant byte diacritics may also be omitted, in which
case the placeholder cell will inherit the missing values from the placeholder
cell to the left, following the algorithm:

- If no diacritics are present, and the previous placeholder cell has the same
  foreground and underline colors, then the row of the current cell will be the
  row of the cell to the left, the column will be the column of the cell to the
  left plus one, and the most significant image ID byte will be the most
  significant image ID byte of the cell to the left.
- If only the row diacritic is present, and the previous placeholder cell has
  the same row and the same foreground and underline colors, then the column of
  the current cell will be the column of the cell to the left plus one, and the
  most significant image ID byte will be the most significant image ID byte of
  the cell to the left.
- If only the row and column diacritics are present, and the previous
  placeholder cell has the same row, the same foreground and underline colors,
  and its column is one less than the current column, then the most significant
  image ID byte of the current cell will be the most significant image ID byte
  of the cell to the left.

These rules are applied left-to-right, which allows specifying only row
diacritics of the first column, i.e. here is a 2 rows by 3 columns placeholder:

.. code-block:: sh

    printf "\e[38;5;42m\U10EEEE\U0305\U10EEEE\U10EEEE\n"
    printf "\e[38;5;42m\U10EEEE\U030D\U10EEEE\U10EEEE\n"

This will not work for horizontal scrolling and overlapping images since the two
given rules will fail to guess the missing information. In such cases, the
terminal may apply other heuristics (but it doesn't have to).

It is important to distinguish between virtual image placements and real images
displayed on top of Unicode placeholders. Virtual placements are invisible and only play
the role of prototypes for real images. Virtual placements can be deleted by a
deletion command only when the `d` key is equal to ``i``, ``I``, ``r``, ``R``, ``n`` or ``N``.
The key values ``a``, ``c``, ``p``, ``q``, ``x``, ``y``, ``z`` and their capital
variants never affect virtual placements because they do not have a physical
location on the screen.

Real images displayed on top of Unicode placeholders are not considered
placements from the protocol perspective. They cannot be manipulated using
graphics commands, instead they should be moved, deleted, or modified by
manipulating the underlying Unicode placeholder as normal text.

.. _relative_image_placement:

Relative placements
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 0.31.0
   Support for positioning images relative to other images

You can specify that a placement is positioned relative to another placement.
This is particularly useful in combination with
:ref:`graphics_unicode_placeholders` above. It can be used to specify a single
transparent pixel image using a Unicode placeholder, which moves around
naturally with the text, the real image(s) can base their position relative to
the placeholder.

To specify that a placement should be relative to another, use the
``P=<image_id>,Q=<placement_id>`` keys, when creating the relative placement.
For example::

    <ESC>_Ga=p,i=<image_id>,p=<placement_id>,P=<parent_img_id>,Q=<parent_placement_id><ESC>\

This will create a *relative placement* that refers to the *parent placement*
specified by the ``P`` and ``Q`` keys. When the parent placement moves, the
relative placement moves along with it. The relative placement can be offset
from the parent's location by a specified number of cells, using the ``H`` and
``V`` keys for horizontal and vertical displacement. Positive values move right
and down. Negative values move left and up. The origin is the top left cell of
the parent placement.

The lifetime of a relative placement is tied to the lifetime of its parent. If
its parent is deleted, it is deleted as well. If the image that the relative
placement is a placement of, has no more placements, the image is deleted as
well. Thus, a parent and its relative placements form a *group* that is managed
together.

A relative placement can refer to another relative placement as its parent.
Thus the relative placements can form a chain. It is implementation dependent
how long a chain of such placements is allowed, but implementation must allow
a chain of length at least 8. If the implementation max depth is exceeded, the
terminal must respond with the ``ETOODEEP`` error code.

Virtual placements created for Unicode placeholder based images cannot also be
relative placements. However, a relative placement can refer to a virtual
placement as its parent. When a virtual placement is the parent, its position
is derived from all the actual Unicode placeholder images that refer to it.
The x position is the minimum of all the placeholder x positions and the y
position is the minimum of all the placeholder y positions. If a client
attempts to make a virtual placement relative the terminal must respond with
the ``EINVAL`` error code.

Terminals are required to reject the creation of a relative placement
that would create a cycle, such as when A is relative to B and B is relative to
C and C is relative to A. In such cases, the terminal must respond with the
``ECYCLE`` error code.

If a client attempts to create a reference to a placement that does not exist
the terminal must respond with the ``ENOPARENT`` error code.

.. note::
   Since a relative placement gets its position specified based on another
   placement, instead of the cursor, the cursor must not move after a relative
   position, regardless of the value of the ``C`` key to control cursor
   movement.


Deleting images
---------------------

Images can be deleted by using the delete action ``a=d``. If specified without any
other keys, it will delete all images visible on screen. To delete specific images,
use the `d` key as described in the table below. Note that each value of d has
both a lowercase and an uppercase variant. The lowercase variant only deletes the
images without necessarily freeing up the stored image data, so that the images can be
re-displayed without needing to resend the data. The uppercase variants will delete
the image data as well, provided that the image is not referenced elsewhere, such as in the
scrollback buffer. The values of the ``x`` and ``y`` keys are the same as cursor positions (i.e.
``x=1, y=1`` is the top left cell).

=================    ============
Value of ``d``       Meaning
=================    ============
``a`` or ``A``       Delete all placements visible on screen
``i`` or ``I``       Delete all images with the specified id, specified using the ``i`` key. If you specify a ``p`` key for the placement                          id as well, then only the placement with the specified image id and placement id will be deleted.
``n`` or ``N``       Delete newest image with the specified number, specified using the ``I`` key. If you specify a ``p`` key for the
                     placement id as well, then only the placement with the specified number and placement id will be deleted.
``c`` or ``C``       Delete all placements that intersect with the current cursor position.
``f`` or ``F``       Delete animation frames.
``p`` or ``P``       Delete all placements that intersect a specific cell, the cell is specified using the ``x`` and ``y`` keys
``q`` or ``Q``       Delete all placements that intersect a specific cell having a specific z-index. The cell and z-index is specified using the ``x``, ``y`` and ``z`` keys.
``r`` or ``R``       Delete all images whose id is greater than or equal to the value of the ``x`` key and less than or equal to the value of the ``y`` (added in kitty version 0.33.0).
``x`` or ``X``       Delete all placements that intersect the specified column, specified using the ``x`` key.
``y`` or ``Y``       Delete all placements that intersect the specified row, specified using the ``y`` key.
``z`` or ``Z``       Delete all placements that have the specified z-index, specified using the ``z`` key.
=================    ============


Note when all placements for an image have been deleted, the image is also
deleted, if the capital letter form above is specified. Also, when the terminal
is running out of quota space for new images, existing images without
placements will be preferentially deleted.

If an image is being loaded in chunks and the upload is not complete when any
delete command is received, the partial upload must be aborted.

Some examples::

    <ESC>_Ga=d<ESC>\              # delete all visible placements
    <ESC>_Ga=d,d=i,i=10<ESC>\     # delete the image with id=10, without freeing data
    <ESC>_Ga=d,d=i,i=10,p=7<ESC>\ # delete the image with id=10 and placement id=7, without freeing data
    <ESC>_Ga=d,d=Z,z=-1<ESC>\     # delete the placements with z-index -1, also freeing up image data
    <ESC>_Ga=d,d=p,x=3,y=4<ESC>\  # delete all placements that intersect the cell at (3, 4), without freeing data


Suppressing responses from the terminal
-------------------------------------------

If you are using the graphics protocol from a limited client, such as a shell
script, it might be useful to avoid having to process responses from the
terminal. For this, you can use the ``q`` key. Set it to ``1`` to suppress
``OK`` responses and to ``2`` to suppress failure responses.

.. versionadded:: 0.19.3
   The ability to suppress responses (see :doc:`kittens/query_terminal` to query kitty version)


Requesting image ids from the terminal
-------------------------------------------

If you are writing a program that is going to share the screen with other
programs and you still want to use image ids, it is not possible to know
what image ids are free to use. In this case, instead of using the ``i``
key to specify an image id use the ``I`` key to specify an image number
instead. These numbers are not unique.
When creating a new image, even if an existing image has the same number a new
one is created. And the terminal will reply with the id of the newly created
image. For example, when creating an image with ``I=13``, the terminal will
send the response::

    <ESC>_Gi=99,I=13;OK<ESC>\

Here, the value of ``i`` is the id for the newly created image and the value of
``I`` is the same as was sent in the creation command.

All future commands that refer to images using the image number, such as
creating placements or deleting images, will act on only the newest image with
that number. This allows the client program to send a bunch of commands dealing
with an image by image number without waiting for a response from the terminal
with the image id. Once such a response is received, the client program should
use the ``i`` key with the image id for all future communication.

.. note:: Specifying both ``i`` and ``I`` keys in any command is an error. The
   terminal must reply with an EINVAL error message, unless silenced.

.. versionadded:: 0.19.3
   The ability to use image numbers (see :doc:`kittens/query_terminal` to query kitty version)


.. _animation_protocol:

Animation
-------------------------------------------

.. versionadded:: 0.20.0
   Animation support (see :doc:`kittens/query_terminal` to query kitty version)

When designing support for animation, the two main considerations were:

#. There should be a way for both client and terminal driven animations.
   Since there is unknown and variable latency between client and terminal,
   especially over SSH, client driven animations are not sufficient.

#. Animations often consist of small changes from one frame to the next, the
   protocol should thus allow transmitting these deltas for efficiency and
   performance reasons.

Animation support is added to the protocol by adding two new modes for the
``a`` (action) key. A ``f`` mode for transmitting frame data and an ``a`` mode
for controlling the animation of an image. Animation proceeds in two steps,
first a normal image is created as described earlier. Then animation frames are
added to the image to make it into an animation. Since every animation is
associated with a single image, all animation escape codes must specify either
the ``i`` or ``I`` keys to identify the image being operated on.


Transferring animation frame data
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Transferring animation frame data is very similar to
:ref:`transferring_pixel_data` above. The main difference is that the image
the frame belongs to must be specified and it is possible to transmit data for
only part of a frame, declaring the rest of the frame to be filled in by data
from a previous frame, or left blank. To transfer frame data the ``a=f``
key must be used in all escape codes.

First, to transfer a simple frame that has data for the full image area, the
escape codes used are exactly the same as for transferring image data, with the
addition of: ``a=f,i=<image id>`` or ``a=f,I=<image number>``.

If the frame has data for only a part of the image, you can specify the
rectangle for it using the ``x, y, s, v`` keys, for example::

    x=10,y=5,s=100,v=200  # A 100x200 rectangle with its top left corner at (10, 5)

Frames are created by composing the transmitted data onto a background canvas.
This canvas can be either a single color, or the pixels from a previous frame.
The composition can be of two types, either a simple replacement (``X=1``) key
or a full alpha blend (the default).

To use a background color for the canvas, specify the ``Y`` key as a 32-bit
RGBA color. For example::

    Y=4278190335 # 0xff0000ff opaque red
    Y=16711816   # 0x00ff0088 translucent green (alpha=0.53)

The default background color when none is specified is ``0`` i.e. a black,
transparent pixel.

To use the data from a previous frame, specify the ``c`` key which is a 1-based
frame number. Thus ``c=1`` refers to the root frame (the base image data),
``c=2`` refers to the second frame and so on.

If the frame is composed of multiple rectangular blocks, these can be expressed
by using the ``r`` key. When specifying the ``r`` key the data for an existing
frame is edited. The same composition operation as above happens, but now the
background canvas is the existing frame itself. ``r`` is a 1-based index, so
``r=1`` is the root frame (base image data), ``r=2`` is the second frame and so
on.

Finally, while transferring frame data, the frame *gap* can also be specified
using the ``z`` key. The gap is the number of milliseconds to wait before
displaying the next frame when the animation is running. A value of ``z=0`` is
ignored (acts as though ``z`` was unspecified), ``z=positive number`` sets the
gap to the specified number of milliseconds and ``z=negative number`` creates a
*gapless* frame. Gapless frames are not displayed to the user since they are
instantly skipped over, however they can be useful as the base data for
subsequent frames. For example, for an animation where the background remains
the same and a small object or two move.

Controlling animations
~~~~~~~~~~~~~~~~~~~~~~~~~~

Clients can control animations by using the ``a=a`` key in the escape code sent
to the terminal.

The simplest is client driven animations, where the client transmits the frame
data and then also instructs the terminal to make a particular frame the current
frame.  To change the current frame, use the ``c`` key::

    <ESC>_Ga=a,i=3,c=7<ESC>\

This will make the seventh frame in the image with id ``3`` the current frame.

However, client driven animations can be sub-optimal, since the latency between
the client and terminal is unknown and variable especially over the network.
Also they require the client to remain running for the lifetime of the
animation, which is not desirable for cat like utilities.

Terminal driven animations are achieved by the client specifying *gaps* (time
in milliseconds) between frames and instructing the terminal to stop or start
the animation.

The animation state is controlled by the ``s`` key. ``s=1`` stops the
animation. ``s=2`` runs the animation, but in *loading* mode, in this mode when
reaching the last frame, instead of looping, the terminal will wait for the
arrival of more frames. ``s=3`` runs the animation normally, after the last
frame, the terminal loops back to the first frame. The number of loops can be
controlled by the ``v`` key. ``v=0`` is ignored (acts as though ``v`` was not
specified), ``v=1`` is loop infinitely, and any other positive number is loop
``number - 1`` times. Note that stopping the animation resets the loop counter.

Finally, the *gap* for frames can be set using the ``z`` key. This can be
specified either when the frame is created as part of the transmit escape code
or separately using the animation control escape code. The *gap* is the time in
milliseconds to wait before displaying the next frame in the animation.
For example::

    <ESC>_Ga=a,i=7,r=3,z=48<ESC>\

This sets the gap for the third frame of the image with id ``7`` to ``48``
milliseconds. Note that *gapless* frames are not displayed to the user since
the next frame comes immediately, however they can be useful to store base data
for subsequent frames, such as in an animation with an object moving against a
static background.

In particular, the first frame or *root frame* is created with the base image
data and has no gap, so its gap must be set using this control code.

Composing animation frames
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 0.22.0
   Support for frame composition

Clients can *compose* animation frames, this means that they can compose pixels
in rectangular regions from one frame onto another frame. This allows for fast
and low band-width modification of frames.

To achieve this use the ``a=c`` key. The source frame is specified with
``r=frame number`` and the destination frame as ``c=frame number``. The size of
the rectangle is specified as ``w=width,h=height`` pixels. If unspecified, the
full image width and height are used. The offset of the rectangle from the
top-left corner for the source frame is specified by the ``x,y`` keys and the
destination frame by the ``X,Y`` keys. The composition operation is specified
by the ``C`` key with the default being to alpha blend the source rectangle
onto the destination rectangle. With ``C=1`` it will be a simple replacement
of pixels. For example::

    <ESC>_Ga=c,i=1,r=7,c=9,w=23,h=27,X=4,Y=8,x=1,y=3<ESC>\

Will compose a ``23x27`` rectangle located at ``(4, 8)`` in the ``7th frame``
onto the rectangle located at ``(1, 3)`` in the ``9th frame``. These will be
in the image with ``id=1``.

If the frames or the image are not found the terminal emulator must
respond with `ENOENT`. If the rectangles go out of bounds of the image
the terminal must respond with `EINVAL`. If the source and destination frames are
the same and the rectangles overlap, the terminal must respond with `EINVAL`.


.. note::
   In kitty, doing a composition will cause a frame to be *fully rendered*
   potentially increasing its storage requirements, when the frame was previously
   stored as a set of operations on other frames. If this happens and there
   is not enough storage space, kitty will respond with ENOSPC.


Image persistence and storage quotas
-----------------------------------------

In order to avoid *Denial-of-Service* attacks, terminal emulators should have a
maximum storage quota for image data. It should allow at least a few full
screen images.  For example the quota in kitty is 320MB per buffer. When adding
a new image, if the total size exceeds the quota, the terminal emulator should
delete older images to make space for the new one. In kitty, for animations,
the additional frame data is stored on disk and has a separate, larger quota of
five times the base quota.


Control data reference
---------------------------

The table below shows all the control data keys as well as what values they can
take, and the default value they take when missing. All integers are 32-bit.

=======  ====================  =========  =================
Key      Value                 Default    Description
=======  ====================  =========  =================
``a``    Single character.     ``t``      The overall action this graphics command is performing.
         ``(a, c, d, f,                   ``t`` - transmit data, ``T`` - transmit data and display image,
         p, q, t, T)``                    ``q`` - query terminal, ``p`` - put (display) previous transmitted image,
                                          ``d`` - delete image, ``f`` - transmit data for animation frames,
                                          ``a`` - control animation, ``c`` - compose animation frames

``q``    ``0, 1, 2``           ``0``      Suppress responses from the terminal to this graphics command.

**Keys for image transmission**
-----------------------------------------------------------
``f``    Positive integer.     ``32``     The format in which the image data is sent.
         ``(24, 32, 100)``.
``t``    Single character.     ``d``      The transmission medium used.
         ``(d, f, t, s)``.
``s``    Positive integer.     ``0``      The width of the image being sent.
``v``    Positive integer.     ``0``      The height of the image being sent.
``S``    Positive integer.     ``0``      The size of data to read from a file.
``O``    Positive integer.     ``0``      The offset from which to read data from a file.
``i``    Positive integer.
         ``(0 - 4294967295)``  ``0``      The image id
``I``    Positive integer.
         ``(0 - 4294967295)``  ``0``      The image number
``p``    Positive integer.
         ``(0 - 4294967295)``  ``0``      The placement id
``o``    Single character.     ``null``   The type of data compression.
         ``only z``
``m``    zero or one           ``0``      Whether there is more chunked data available.

**Keys for image display**
-----------------------------------------------------------
``x``    Positive integer      ``0``      The left edge (in pixels) of the image area to display
``y``    Positive integer      ``0``      The top edge (in pixels) of the image area to display
``w``    Positive integer      ``0``      The width (in pixels) of the image area to display. By default, the entire width is used
``h``    Positive integer      ``0``      The height (in pixels) of the image area to display. By default, the entire height is used
``X``    Positive integer      ``0``      The x-offset within the first cell at which to start displaying the image
``Y``    Positive integer      ``0``      The y-offset within the first cell at which to start displaying the image
``c``    Positive integer      ``0``      The number of columns to display the image over
``r``    Positive integer      ``0``      The number of rows to display the image over
``C``    Positive integer      ``0``      Cursor movement policy. ``0`` is the default, to move the cursor to after the image.
                                          ``1`` is to not move the cursor at all when placing the image.
``U``    Positive integer      ``0``      Set to ``1`` to create a virtual placement for a Unicode placeholder.
``z``    32-bit integer        ``0``      The *z-index* vertical stacking order of the image
``P``    Positive integer      ``0``      The id of a parent image for relative placement
``Q``    Positive integer      ``0``      The id of a placement in the parent image for relative placement
``H``    32-bit integer        ``0``      The offset in cells in the horizontal direction for relative placement
``V``    32-bit integer        ``0``      The offset in cells in the vertical direction for relative placement

**Keys for animation frame loading**
-----------------------------------------------------------
``x``    Positive integer      ``0``      The left edge (in pixels) of where the frame data should be updated
``y``    Positive integer      ``0``      The top edge (in pixels) of where the frame data should be updated
``c``    Positive integer      ``0``      The 1-based frame number of the frame whose image data serves as the base data
                                          when creating a new frame, by default the base data is black, fully transparent pixels
``r``    Positive integer      ``0``      The 1-based frame number of the frame that is being edited. By default, a new frame is created
``z``    32-bit integer        ``0``      The gap (in milliseconds) of this frame from the next one. A value of
                                          zero is ignored. Negative values create a *gapless* frame. If not specified,
                                          frames have a default gap of ``40ms``. The root frame defaults to zero gap.
``X``    Positive integer      ``0``      The composition mode for blending pixels when creating a new frame or
                                          editing a frame's data. The default is full alpha blending. ``1`` means a
                                          simple overwrite.
``Y``    Positive integer      ``0``      The background color for pixels not
                                          specified in the frame data. Must be in 32-bit RGBA format

**Keys for animation frame composition**
-----------------------------------------------------------

``c``    Positive integer      ``0``      The 1-based frame number of the frame whose image data serves as the overlaid data
``r``    Positive integer      ``0``      The 1-based frame number of the frame that is being edited.
``x``    Positive integer      ``0``      The left edge (in pixels) of the destination rectangle
``y``    Positive integer      ``0``      The top edge (in pixels) of the destination rectangle
``w``    Positive integer      ``0``      The width (in pixels) of the source and destination rectangles. By default, the entire width is used
``h``    Positive integer      ``0``      The height (in pixels) of the source and destination rectangles. By default, the entire height is used
``X``    Positive integer      ``0``      The left edge (in pixels) of the source rectangle
``Y``    Positive integer      ``0``      The top edge (in pixels) of the source rectangle
``C``    Positive integer      ``0``      The composition mode for blending
                                          pixels. Default is full alpha blending. ``1`` means a simple overwrite.


**Keys for animation control**
-----------------------------------------------------------
``s``    Positive integer      ``0``      ``1`` - stop animation, ``2`` - run animation, but wait for new frames, ``3`` - run animation
``r``    Positive integer      ``0``      The 1-based frame number of the frame that is being affected
``z``    32-bit integer        ``0``      The gap (in milliseconds) of this frame from the next one. A value of
                                          zero is ignored. Negative values create a *gapless* frame.
``c``    Positive integer      ``0``      The 1-based frame number of the frame that should be made the current frame
``v``    Positive integer      ``0``      The number of loops to play. ``0`` is
                                          ignored, ``1`` is play infinite and is the default and larger number
                                          means play that number ``-1`` loops


**Keys for deleting images**
-----------------------------------------------------------
``d``    Single character.     ``a``      What to delete.
         ``(
         a, A, c, C, n, N,
         i, I, p, P, q, Q, r,
         R, x, X, y, Y, z, Z
         )``.
=======  ====================  =========  =================


Interaction with other terminal actions
--------------------------------------------

When resetting the terminal, all images that are visible on the screen must be
cleared.  When switching from the main screen to the alternate screen buffer
(1049 private mode) all images in the alternate screen must be cleared, just as
all text is cleared. The clear screen escape code (usually ``<ESC>[2J``) should
also clear all images. This is so that the clear command works.

The other commands to erase text must have no effect on graphics.
The dedicated delete graphics commands must be used for those.

When scrolling the screen (such as when using index cursor movement commands,
or scrolling through the history buffer), images must be scrolled along with
text. When page margins are defined and the index commands are used, only
images that are entirely within the page area (between the margins) must be
scrolled. When scrolling them would cause them to extend outside the page area,
they must be clipped.
```

## File: docs/index.rst
```rst
kitty
==========================================================

*If you live in the terminal, kitty is made for YOU!*

The fast, feature-rich, GPU based terminal emulator.

.. toctree::
    :hidden:

    quickstart
    overview
    faq
    support
    sessions
    performance
    changelog
    integrations
    protocol-extensions
    press-mentions


.. tab:: Fast

   * Uses GPU and SIMD vector CPU instructions for :doc:`best in class performance <performance>`
   * Uses threaded rendering for :iss:`absolutely minimal latency <2701#issuecomment-636497270>`
   * Performance tradeoffs can be :ref:`tuned <conf-kitty-performance>`

.. tab:: Capable

   * Graphics, with :doc:`images and animations <graphics-protocol>`
   * Ligatures, emoji with :opt:`per glyph font substitution <symbol_map>` and :doc:`variable fonts and font features </kittens/choose-fonts>`
   * :term:`Hyperlinks<hyperlinks>`, with :doc:`configurable actions <open_actions>`

.. tab:: Scriptable

   * Control from :doc:`scripts or the shell <remote-control>`
   * Extend with :ref:`kittens <kittens>` using the Python language
   * Use :ref:`startup sessions <sessions>` to specify working environments

.. tab:: Composable

   * Programmable tabs, :ref:`splits <splits_layout>` and multiple :doc:`layouts <layouts>` to manage windows
   * Browse the :ref:`entire history <scrollback>` or the :sc:`output from the last command <show_last_command_output>`
     comfortably in pagers and editors
   * Edit or download :doc:`remote files <kittens/remote_file>` in an existing SSH session

.. tab:: Cross-platform

   * Linux
   * macOS
   * Various BSDs

.. tab:: Innovative

   Pioneered various extensions to move the entire terminal ecosystem forward

   * :doc:`graphics-protocol`
   * :doc:`keyboard-protocol`
   * Lots more in :doc:`protocol-extensions`


To get started see :doc:`quickstart`.

.. only:: dirhtml

   .. include:: intro_vid.rst
```

## File: docs/integrations.rst
```rst
:tocdepth: 2

Integrations with other tools
================================

kitty provides extremely powerful interfaces such as :doc:`remote-control` and
:doc:`kittens/custom` and :doc:`kittens/icat` that allow it to be integrated
with other tools seamlessly.


Image and document viewers
----------------------------

Powered by kitty's :doc:`graphics-protocol` there exist many tools for viewing
images and other types of documents directly in your terminal, even over SSH.

.. _tool_termpdf:

`termpdf.py <https://github.com/dsanson/termpdf.py>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A terminal PDF/DJVU/CBR viewer

.. _tool_tdf:

`tdf <https://github.com/itsjunetime/tdf>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A terminal PDF viewer

.. _tool_fancy_cat:

`fancy-cat <https://github.com/freref/fancy-cat>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A terminal PDF viewer

.. _tool_meowpdf:

`meowpdf <https://github.com/monoamine11231/meowpdf>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A terminal PDF viewer with GUI-like usage and Vim-like keybindings written in Rust

.. _tool_mcat:

`mcat <https://github.com/Skardyy/mcat>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Display various types of files nicely formatted with images in the terminal

`dawn <https://github.com/andrewmd5/dawn>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A markdown editor that uses the text-sizing protocol for large headings and
the graphics protocol for images.

`presenterm <https://github.com/mfontanini/presenterm>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Show markdown based slides with images in your terminal, powered by the
kitty graphics protocol.

.. _tool_mdfried:

`mdfried <https://github.com/benjajaja/mdfried>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Markdown viewer that can render big headers with the text-sizing-protocol, and
also render images with the kitty graphics protocol.

.. _tool_term_image:

`term-image <https://github.com/AnonymouX47/term-image>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Tool to browse images in a terminal using kitty's graphics protocol.

.. _tool_koneko:

`koneko <https://github.com/twenty5151/koneko>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Browse images from the pixiv artist community directly in kitty.

.. _tool_viu:

`viu <https://github.com/atanunq/viu>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
View images in the terminal, similar to kitty's icat.

.. _tool_nb:


`nb <https://github.com/xwmx/nb>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Command line and local web note-taking, bookmarking, archiving, and knowledge
base application that uses kitty's graphics protocol for images.

.. _tool_w3m:

`w3m <https://github.com/tats/w3m>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A text mode WWW browser that supports kitty's graphics protocol to display
images.

.. _tool_awrit:

`awrit <https://github.com/chase/awrit>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A full Chromium based web browser running in the terminal using kitty's
graphics protocol.

.. _tool_chawan:

`chawan <https://sr.ht/~bptato/chawan/>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A text mode WWW browser that supports kitty's graphics protocol to display
images.

.. _tool_mpv:

`mpv <https://github.com/mpv-player/mpv/commit/874e28f4a41a916bb567a882063dd2589e9234e1>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A video player that can play videos in the terminal.

.. code-block:: sh

    mpv --profile=sw-fast --vo=kitty --vo-kitty-use-shm=yes --really-quiet video.mkv

.. _tool_timg:

`timg <https://github.com/hzeller/timg>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A terminal image and video viewer, that displays static and animated images or
plays videos. Fast multi-threaded loading, JPEG exif rotation, grid view and
connecting to the webcam make it a versatile terminal utility.


File managers
-------------------
.. _tool_ranger:

`ranger <https://github.com/ranger/ranger>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A terminal file manager, with previews of file contents powered by kitty's
graphics protocol.

.. _tool_nnn:

`nnn <https://github.com/jarun/nnn/>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Another terminal file manager, with previews of file contents powered by kitty's
graphics protocol.

.. _tool_yazi:

`Yazi <https://github.com/sxyazi/yazi>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Blazing fast terminal file manager, with built-in kitty graphics protocol support
(implemented both Classic protocol and Unicode placeholders).

.. _tool_clifm:

`clifm <https://github.com/leo-arch/clifm>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
The shell-like, command line terminal file manager, uses the kitty graphics and
keyboard protocols.

.. _tool_hunter:

`hunter <https://github.com/rabite0/hunter>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Another terminal file manager, with previews of file contents powered by kitty's
graphics protocol.

.. _tool_presentterm:


System and data visualisation tools
---------------------------------------

.. _tool_neofetch:

`neofetch <https://github.com/dylanaraps/neofetch>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A command line system information tool that shows images using kitty's graphics
protocol

.. _tool_matplotlib:

matplotlib
^^^^^^^^^^^^^^

There exist multiple backends for matplotlib to draw images directly in kitty.

* `matplotlib-backend-kitty <https://github.com/jktr/matplotlib-backend-kitty>`__
* `kitcat <https://github.com/mil-ad/kitcat>`__

.. _tool_KittyTerminalImage:

`KittyTerminalImages.jl <https://github.com/simonschoelly/KittyTerminalImages.jl>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Show images from Julia directly in kitty

.. _tool_euporie:

`euporie <https://github.com/joouha/euporie>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A text-based user interface for running and editing Jupyter notebooks, powered
by kitty's graphics protocol for displaying plots

.. _tool_gnuplot:

`gnuplot <http://www.gnuplot.info/>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A graphing and data visualization tool that has support for the kitty graphics
protocol, with its ``kittygd`` and ``kittycairo`` backends.

.. _tool_k-nine:

`k-nine <https://github.com/talwrii/kitty-plotnine>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A wrapper around the :code:`plotnine` library which lets you plot data from the command-line with bash one-liners.

.. tool_tgutui:

`tgutui <https://github.com/tgu-ltd/tgutui>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A Terminal Operating Test hardware equipment

.. tool_onefetch:

`onefetch <https://github.com/o2sh/onefetch>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A tool to fetch information about your git repositories

.. tool_patat:

`patat <https://github.com/jaspervdj/patat>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Terminal based presentations using pandoc and kitty's image protocol for
images

.. tool_wttr:

`wttr.in <https://github.com/chubin/wttr.in>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A tool to display weather information in your terminal with curl

.. tool_wl_clipboard:

`wl-clipboard-manager <https://github.com/maximbaz/wl-clipboard-manager>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
View and manage the system clipboard under Wayland in your kitty terminal

.. tool_nemu:

`NEMU <https://github.com/nemuTUI/nemu>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
TUI for QEMU used to manage virtual machines, can display the Virtual Machine
in the terminal using the kitty graphics protocol.

Editor integration
-----------------------

|kitty| can be integrated into many different terminal based text editors to add
features such a split windows, previews, REPLs etc.

.. tool_kakoune:

`kakoune <https://kakoune.org/>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Integrates with kitty to use native kitty windows for its windows/panels and
REPLs.

.. tool_vim_slime:

`vim-slime <https://github.com/jpalardy/vim-slime#kitty>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Uses kitty remote control for a Lisp REPL.

.. tool_vim_kitty_navigator:

`vim-kitty-navigator <https://github.com/knubie/vim-kitty-navigator>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Allows you to navigate seamlessly between vim and kitty splits using a
consistent set of hotkeys.

.. tool_vim_test:

`vim-test <https://github.com/vim-test/vim-test>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Allows easily running tests in a terminal window

.. tool_nvim_image_viewers:

Various image viewing plugins for editors
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
* `snacks.nvim <https://github.com/folke/snacks.nvim>`__ - Enables seamless inline images in various file formats within nvim
* `image.nvim <https://github.com/3rd/image.nvim>`_ - Bringing images to neovim
* `image_preview.nvim <https://github.com/adelarsq/image_preview.nvim/>`_ - Image preview for neovim
* `hologram.nvim <https://github.com/edluffy/hologram.nvim>`_  - view images inside nvim

Scrollback manipulation
-------------------------

.. tool_kitty_scrollback_nvim:

`kitty-scrollback.nvim <https://github.com/mikesmithgh/kitty-scrollback.nvim>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Browse the scrollback buffer with Neovim, with simple key actions for efficient
copy/paste and even execution of commands.

.. tool_kitty_search:

`kitty-search <https://github.com/trygveaa/kitty-kitten-search>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Live incremental search of the scrollback buffer.

.. tool_kitty_grab:

`kitty-grab <https://github.com/yurikhan/kitty_grab>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Keyboard based text selection for the kitty scrollback buffer.

Desktop panels
-------------------------

`kitty panel <https://github.com/5hubham5ingh/kitty-panel>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A system panel for Kitty terminal that displays real-time system metrics using terminal-based utilities.


`pawbar <https://github.com/codelif/pawbar>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
A kitten-panel based desktop panel for your desktop

Password managers
---------------------

`1password <https://github.com/mm-zacharydavison/kitty-kitten-1password>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Allow injecting passwords from 1Password into kitty.

`BitWarden <https://github.com/dnanhkhoa/kitty-password-manager>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Inject passwords from BitWarden into kitty

Miscellaneous
------------------

.. tool_doom:

DOOM
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Play the classic shooter DOOM in `kitty <https://github.com/cryptocode/terminal-doom>`__ or even inside `neovim inside kitty
<https://github.com/seandewar/actually-doom.nvim>`__.

.. tool_gattino:

`gattino <https://github.com/salvozappa/gattino>`__
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Integrate kitty with an LLM to convert plain language prompts into shell
commands.

.. tool_kitty_smart_tab:

`kitty-smart-tab <https://github.com/yurikhan/kitty-smart-tab>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Use keys to either control tabs or pass them onto running applications if no
tabs are present

.. tool_kitty_smart_scroll:

`kitty-smart-scroll <https://github.com/yurikhan/kitty-smart-scroll>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Use keys to either scroll or pass them onto running applications if no
scrollback buffer is present

.. tool_kitti3:

`kitti3 <https://github.com/LandingEllipse/kitti3>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Allow using kitty as a drop-down terminal under the i3 window manager

.. tool_weechat_hints:

`weechat-hints <https://github.com/GermainZ/kitty-weechat-hints>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
URL hints kitten for WeeChat that works without having to use WeeChat's
raw-mode.

.. tool_glkitty:

`glkitty <https://github.com/michaeljclark/glkitty>`_
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
C library to draw OpenGL shaders in the terminal with a glgears demo
```

## File: docs/intro_vid.rst
```rst
.. raw:: html

    <div id="intro-video-container" class="video-with-timestamps">

    <video controls width="640" height="360" poster="_static/poster.png">
        <source src="https://download.calibre-ebook.com/videos/kitty.mp4" type="video/mp4">
        <source src="https://download.calibre-ebook.com/videos/kitty.webm" type="video/webm">
    </video>

.. rst-class:: caption caption-text

    Watch kitty in action!

Timestamps for the above video:

00:00
    Intro
00:39
    Pager: View command output in same window: :kbd:`Ctrl+Shift+g`
01:43
    Pager: View command output in a separate window
02:14
    Pager: Uses shell integration in kitty
02:27
    Tab text: The output of cwd and last cmd
03:03
    Open files from ls output with mouse: :kbd:`Ctrl+Shift+Right-click`
04:04
    Open files from ls output with keyboard: :kbd:`Ctrl+Shift+P>y`
04:26
    Open files on click: ``ls --hyperlink=auto``
05:03
    Open files on click: Filetype settings in open-actions.conf
05:45
    hyperlinked-grep kitten: Open grep output in editor
07:18
    Remote-file kitten: View remote files locally
08:31
    Remote-file kitten: Edit remote files locally
10:01
    icat kitten: View images directly
10:36
    icat kitten: Download & display image/gif from internet
11:03
    Kitty Graphics Protocol: Live image preview in ranger
11:25
    icat kitten: Display image from remote server
12:04
    unicode-input kitten: Emojis in terminal
12:54
    Windows: Intro
13:36
    Windows: Switch focus: :kbd:`Ctrl+Shift+win_nr`
13:48
    Windows: Visual selection: :kbd:`Ctrl+Shift+F7`
13:58
    Windows: Simultaneous input
14:15
    Interactive Kitty Shell: :kbd:`Ctrl+Shift+Esc`
14:36
    Broadcast text: ``launch --allow-remote-control kitten broadcast``
15:18
    Kitty Remote Control Protocol
15:52
    Interactive Kitty Shell: Help
16:34
    Choose theme interactively: ``kitten themes -h``
17:23
    Choose theme by name: ``kitten themes [options] [theme_name]``

.. raw:: html

    </div>
```

## File: docs/invocation.rst
```rst
:orphan:

The kitty command line interface
====================================

.. program:: kitty

.. include:: generated/cli-kitty.rst

.. include:: basic.rst

See also
-----------

See kitty.conf(5)
```

## File: docs/keyboard-protocol.rst
```rst
Comprehensive keyboard handling in terminals
==============================================

There are various problems with the current state of keyboard handling in
terminals. They include:

* No way to use modifiers other than ``ctrl`` and ``alt``

* No way to reliably use multiple modifier keys, other than, ``shift+alt`` and
  ``ctrl+alt``.

* Many of the existing escape codes used to encode these events are ambiguous
  with different key presses mapping to the same escape code.

* No way to handle different types of keyboard events, such as press, release or repeat

* No reliable way to distinguish single ``Esc`` key presses from the start of a
  escape sequence. Currently, client programs use fragile timing related hacks
  for this, leading to bugs, for example:
  `neovim #2035 <https://github.com/neovim/neovim/issues/2035>`_.

To solve these issues and others, kitty has created a new keyboard protocol,
that is backward compatible but allows applications to opt-in to support more
advanced usages. The protocol is based on initial work in `fixterms
<http://www.leonerd.org.uk/hacks/fixterms/>`_, however, it corrects various
issues in that proposal, listed at the :ref:`bottom of this document
<fixterms_bugs>`. For public discussion of this spec, see :iss:`3248`.

You can see this protocol with all enhancements in action by running::

    kitten show-key -m kitty

inside the kitty terminal to report key events.

In addition to kitty, this protocol is also implemented in:

* The `alacritty terminal <https://github.com/alacritty/alacritty/pull/7125>`__
* The `ghostty terminal <https://ghostty.org>`__
* The `foot terminal <https://codeberg.org/dnkl/foot/issues/319>`__
* The `iTerm2 terminal <https://gitlab.com/gnachman/iterm2/-/issues/10017>`__
* The `rio terminal <https://github.com/raphamorim/rio/commit/cd463ca37677a0fc48daa8795ea46dadc92b1e95>`__
* The `WezTerm terminal <https://wezfurlong.org/wezterm/config/lua/config/enable_kitty_keyboard.html>`__
* The `TuiOS terminal (multiplexer) <https://github.com/Gaurav-Gosain/tuios/issues/26>`__

Libraries implementing this protocol:

* The `notcurses library <https://github.com/dankamongmen/notcurses/issues/2131>`__
* The `crossterm library <https://github.com/crossterm-rs/crossterm/pull/688>`__
* The `textual library <https://github.com/Textualize/textual/pull/4631>`__
* The vaxis library `go <https://sr.ht/~rockorager/vaxis/>`__ and `zig <https://github.com/rockorager/libvaxis/>`__
* The `bubbletea library <https://github.com/charmbracelet/bubbletea/issues/869>`__

Programs implementing this protocol:

* The `Vim text editor <https://github.com/vim/vim/commit/63a2e360cca2c70ab0a85d14771d3259d4b3aafa>`__
* The `Emacs text editor via the kkp package <https://github.com/benjaminor/kkp>`__
* The `Neovim text editor <https://github.com/neovim/neovim/pull/18181>`__
* The `kakoune text editor <https://github.com/mawww/kakoune/issues/4103>`__
* The `dte text editor <https://gitlab.com/craigbarnes/dte/-/issues/138>`__
* The `Helix text editor <https://github.com/helix-editor/helix/pull/4939>`__
* The `Flow control editor <https://github.com/neurocyte/flow?tab=readme-ov-file#requirements>`__
* The `far2l file manager <https://github.com/elfmz/far2l/commit/e1f2ee0ef2b8332e5fa3ad7f2e4afefe7c96fc3b>`__
* The `Yazi file manager <https://github.com/sxyazi/yazi>`__
* The `awrit web browser <https://github.com/chase/awrit>`__
* The `Turbo Vision <https://github.com/magiblot/tvision/commit/6e5a7b46c6634079feb2ac98f0b890bbed59f1ba>`__/`Free Vision <https://gitlab.com/freepascal.org/fpc/source/-/issues/40673#note_2061428120>`__ IDEs
* The `aerc email client <https://git.sr.ht/~rjarry/aerc/commit/d73cf33c2c6c3e564ce8aff04acc329a06eafc54>`__

Shells implementing this protocol:

* The `nushell shell <https://github.com/nushell/nushell/pull/10540>`__
* The `fish shell <https://github.com/fish-shell/fish-shell/commit/8bf8b10f685d964101f491b9cc3da04117a308b4>`__

.. versionadded:: 0.20.0

Quickstart
---------------

If you are an application or library developer just interested in using this
protocol to make keyboard handling simpler and more robust in your application,
without too many changes, do the following:

#. Emit the escape code ``CSI > 1 u`` at application startup if using the main
   screen or when entering alternate screen mode, if using the alternate
   screen.
#. All key events will now be sent in only a few forms to your application,
   that are easy to parse unambiguously.
#. Emit the escape sequence ``CSI < u`` at application exit if using the main
   screen or just before leaving alternate screen mode if using the alternate screen,
   to restore whatever the keyboard mode was before step 1.

Key events will all be delivered to your application either as plain UTF-8
text, or using the following escape codes, for those keys that do not produce
text (``CSI`` is the bytes ``0x1b 0x5b``)::

    CSI number ; modifiers [u~]
    CSI 1; modifiers [ABCDEFHPQS]
    0x0d - for the Enter key
    0x7f or 0x08 - for Backspace
    0x09 - for Tab

The ``number`` in the first form above will be either the Unicode codepoint for a
key, such as ``97`` for the :kbd:`a` key, or one of the numbers from the
:ref:`functional` table below. The ``modifiers`` optional parameter encodes any
modifiers active for the key event. The encoding is described in the
:ref:`modifiers` section.

The second form is used for a few functional keys, such as the :kbd:`Home`,
:kbd:`End`, :kbd:`Arrow` keys and :kbd:`F1` ... :kbd:`F4`, they are enumerated in
the :ref:`functional` table below.  Note that if no modifiers are present the
parameters are omitted entirely giving an escape code of the form ``CSI
[ABCDEFHPQS]``.

If you want support for more advanced features such as repeat and release
events, alternate keys for shortcut matching et cetera, these can be turned on
using :ref:`progressive_enhancement` as documented in the rest of this
specification.

An overview
------------------

Key events are divided into two types, those that produce text and those that
do not. When a key event produces text, the text is sent directly as UTF-8
encoded bytes. This is safe as UTF-8 contains no C0 control codes.
When the key event does not have text, the key event is encoded as an escape code. In
legacy compatibility mode (the default) this uses legacy escape codes, so old terminal
applications continue to work. For more advanced features, such as release/repeat
reporting etc., applications can tell the terminal they want this information by
sending an escape code to :ref:`progressively enhance <progressive_enhancement>` the data reported for
key events.

The central escape code used to encode key events is::

    CSI unicode-key-code:alternate-key-codes ; modifiers:event-type ; text-as-codepoints u

Spaces in the above definition are present for clarity and should be ignored.
``CSI`` is the bytes ``0x1b 0x5b``. All parameters are decimal numbers. Fields
are separated by the semi-colon and sub-fields by the colon. Only the
``unicode-key-code`` field is mandatory, everything else is optional. The
escape code is terminated by the ``u`` character (the byte ``0x75``).


.. _key_codes:

Key codes
~~~~~~~~~~~~~~

The ``unicode-key-code`` above is the Unicode codepoint representing the key, as a
decimal number. For example, the :kbd:`A` key is represented as ``97`` which is
the unicode code for lowercase ``a``. Note that the codepoint used is *always*
the lower-case (or more technically, un-shifted) version of the key. If the
user presses, for example, :kbd:`ctrl+shift+a` the escape code would be ``CSI
97;modifiers u``. It *must not* be ``CSI 65; modifiers u``.

If *alternate key reporting* is requested by the program running in the
terminal, the terminal can send two additional Unicode codepoints, the *shifted
key* and *base layout key*, separated by colons. The shifted key is simply the
upper-case version of ``unicode-codepoint``, or more technically, the shifted
version, in the currently active keyboard layout. So `a` becomes `A` and so on,
based on the current keyboard layout. This is needed to be able to match
against a shortcut such as :kbd:`ctrl+plus` which depending on the type of
keyboard could be either :kbd:`ctrl+shift+equal` or :kbd:`ctrl+plus`. Note that
the shifted key must be present only if shift is also present in the modifiers.

The *base layout key* is the key corresponding to the physical key in the
standard PC-101 key layout. So for example, if the user is using a Cyrillic
keyboard with a Cyrillic keyboard layout pressing the :kbd:`ctrl+С` key will
be :kbd:`ctrl+c` in the standard layout. So the terminal should send the *base
layout key* as ``99`` corresponding to the ``c`` key.

If only one alternate key is present, it is the *shifted key*. If the terminal
wants to send only a base layout key but no shifted key, it must use an empty
sub-field for the shifted key, like this::

  CSI unicode-key-code::base-layout-key


.. _modifiers:

Modifiers
~~~~~~~~~~~~~~

This protocol supports six modifier keys, :kbd:`shift`, :kbd:`alt`,
:kbd:`ctrl`, :kbd:`super`, :kbd:`hyper`, :kbd:`meta`, :kbd:`num_lock` and
:kbd:`caps_lock`. Here :kbd:`super` is either the *Windows/Linux* key or the
:kbd:`command` key on mac keyboards. The :kbd:`alt` key is the :kbd:`option`
key on mac keyboards. :kbd:`hyper` and :kbd:`meta` are typically present only
on X11/Wayland based systems with special XKB rules. Modifiers are encoded as a
bit field with::

    shift     0b1         (1)
    alt       0b10        (2)
    ctrl      0b100       (4)
    super     0b1000      (8)
    hyper     0b10000     (16)
    meta      0b100000    (32)
    caps_lock 0b1000000   (64)
    num_lock  0b10000000  (128)

In the escape code, the modifier value is encoded as a decimal number which is
``1 + actual modifiers``. So to represent :kbd:`shift` only, the value would be
``1 + 1 = 2``, to represent :kbd:`ctrl+shift` the value would be ``1 + 0b101 =
6`` and so on. If the modifier field is not present in the escape code, its
default value is ``1`` which means no modifiers. If a modifier is *active* when
the key event occurs, i.e. if the key is pressed or the lock (for caps lock/num
lock) is enabled, the key event must have the bit for that modifier set.

When the key event is related to an actual modifier key, the corresponding
modifier's bit must be set to the modifier state including the effect for the
current event. For example, when pressing the :kbd:`LEFT_CONTROL` key, the
``ctrl`` bit must be set and when releasing it, it must be reset. When both
left and right control keys are pressed and one is released, the release event
must have the ``ctrl`` bit set. See :iss:`6913` for discussion of this design.

.. _event_types:

Event types
~~~~~~~~~~~~~~~~

There are three key event types: ``press, repeat and release``. They are
reported (if requested ``0b10``) as a sub-field of the modifiers field
(separated by a colon). If no modifiers are present, the modifiers field must
have the value ``1`` and the event type sub-field the type of event. The
``press`` event type has value ``1`` and is the default if no event type sub
field is present. The ``repeat`` type is ``2`` and the ``release`` type is
``3``. So for example::

    CSI key-code             # this is a press event
    CSI key-code;modifier    # this is a press event
    CSI key-code;modifier:1  # this is a press event
    CSI key-code;modifier:2  # this is a repeat event
    CSI key-code;modifier:3  # this is a release event


.. note:: Key events that result in text are reported as plain UTF-8 text, so
   events are not supported for them, unless the application requests *key
   report mode*, see below.

.. _text_as_codepoints:

Text as code points
~~~~~~~~~~~~~~~~~~~~~

The terminal can optionally send the text associated with key events as a
sequence of Unicode code points. This behavior is opt-in by the :ref:`progressive
enhancement <progressive_enhancement>` mechanism described below. Some examples::

    shift+a -> CSI 97 ; 2 ; 65 u   # The text 'A' is reported as 65
    alt+a   -> CSI  0 ;   ; 229 u  # The text 'å' is reported as 229

If multiple code points are present, they must be separated by colons.  If no
known key is associated with the text the key number ``0`` must be used. The
associated text must not contain control codes (control codes are code points
below U+0020 and codepoints in the C0 and C1 blocks). In the above example, the
:kbd:`alt` modifier is consumed by the OS itself to produce the text å and not
sent to the terminal emulator, which gets only a "text input" event and no
information about modifiers, thus the event gets encoded with no modifiers.
The exact behavior in these situations depends on the OS, keyboard layout, IME
system in use and so on. In general, if the terminal emulator receives no key
information, the key number 0 must be used to indicate a pure "text event".


Non-Unicode keys
~~~~~~~~~~~~~~~~~~~~~~~

There are many keys that don't correspond to letters from human languages, and
thus aren't represented in Unicode. Think of functional keys, such as
:kbd:`Escape`, :kbd:`Play`, :kbd:`Pause`, :kbd:`F1`, :kbd:`Home`, etc. These
are encoded using Unicode code points from the Private Use Area (``57344 -
63743``). The mapping of key names to code points for these keys is in the
:ref:`Functional key definition table below <functional>`.


.. _progressive_enhancement:

Progressive enhancement
--------------------------

While, in theory, every key event could be completely represented by this
protocol and all would be hunk-dory, in reality there is a vast universe of
existing terminal programs that expect legacy control codes for key events and
that are not likely to ever be updated. To support these, in default mode,
the terminal will emit legacy escape codes for compatibility. If a terminal
program wants more robust key handling, it can request it from the terminal,
via the mechanism described here. Each enhancement is described in detail
below. The escape code for requesting enhancements is::

    CSI = flags ; mode u

Here ``flags`` is a decimal encoded integer to specify a set of bit-flags. The
meanings of the flags are given below. The second, ``mode`` parameter is
optional (defaulting to ``1``) and specifies how the flags are applied.
The value ``1`` means all set bits are set and all unset bits are reset.
The value ``2`` means all set bits are set, unset bits are left unchanged.
The value ``3`` means all set bits are reset, unset bits are left unchanged.

.. csv-table:: The progressive enhancement flags
   :header: "Bit", "Meaning"

   "0b1 (1)", ":ref:`disambiguate`"
   "0b10 (2)", ":ref:`report_events`"
   "0b100 (4)", ":ref:`report_alternates`"
   "0b1000 (8)", ":ref:`report_all_keys`"
   "0b10000 (16)", ":ref:`report_text`"

The program running in the terminal can query the terminal for the
current values of the flags by sending::

    CSI ? u

The terminal will reply with::

    CSI ? flags u

The program can also push/pop the current flags onto a stack in the
terminal with::

    CSI > flags u  # for push, if flags omitted default to zero
    CSI < number u # to pop number entries, defaulting to 1 if unspecified

Terminals should limit the size of the stack as appropriate, to prevent
Denial-of-Service attacks. Terminals must maintain separate stacks for the main
and alternate screens. If a pop request is received that empties the stack,
all flags are reset. If a push request is received and the stack is full, the
oldest entry from the stack must be evicted.

.. note:: The main and alternate screens in the terminal emulator must maintain
   their own, independent, keyboard mode stacks. This is so that a program that
   uses the alternate screen such as an editor, can change the keyboard mode
   in the alternate screen only, without affecting the mode in the main screen
   or even knowing what that mode is. Without this, and if no stack is
   implemented for keyboard modes (such as in some legacy terminal emulators)
   the editor would have to somehow know what the keyboard mode of the main
   screen is and restore to that mode on exit.

.. _disambiguate:

Disambiguate escape codes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This type of progressive enhancement (``0b1``) fixes the problem of some legacy key press
encodings overlapping with other control codes. For instance, pressing the
:kbd:`Esc` key generates the byte ``0x1b`` which also is used to indicate the
start of an escape code. Similarly pressing the key :kbd:`alt+[` will generate
the bytes used for CSI control codes.

Turning on this flag will cause the terminal to report the :kbd:`Esc`, :kbd:`alt+key`,
:kbd:`ctrl+key`, :kbd:`ctrl+alt+key`, :kbd:`shift+alt+key` keys using ``CSI u`` sequences instead
of legacy ones. Here key is any ASCII key as described in :ref:`legacy_text`.
Additionally, all non text keypad keys will be reported as separate keys with ``CSI u``
encoding, using dedicated numbers from the :ref:`table below <functional>`.

With this flag turned on, all key events that do not generate text are
represented in one of the following two forms::

    CSI number; modifier u
    CSI 1; modifier [~ABCDEFHPQS]

This makes it very easy to parse key events in an application. In particular,
:kbd:`ctrl+c` will no longer generate the ``SIGINT`` signal, but instead be
delivered as a ``CSI u`` escape code. This has the nice side effect of making it
much easier to integrate into the application event loop. The only exceptions
are the :kbd:`Enter`, :kbd:`Tab` and :kbd:`Backspace` keys which still generate the same
bytes as in legacy mode this is to allow the user to type and execute commands
in the shell such as ``reset`` after a program that sets this mode crashes
without clearing it. Note that the Lock modifiers are not reported for text
producing keys, to keep them usable in legacy programs. To get lock modifiers
for all keys use the :ref:`report_all_keys` enhancement.

.. _report_events:

Report event types
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This progressive enhancement (``0b10``) causes the terminal to report key repeat
and key release events. Normally only key press events are reported and key
repeat events are treated as key press events. See :ref:`event_types` for
details on how these are reported.

.. note::

   The :kbd:`Enter`, :kbd:`Tab` and :kbd:`Backspace` keys will not have release
   events unless :ref:`report_all_keys` is also set, so that the user can still
   type reset at a shell prompt when a program that sets this mode ends without
   resetting it.

.. _report_alternates:

Report alternate keys
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This progressive enhancement (``0b100``) causes the terminal to report
alternate key values *in addition* to the main value, to aid in shortcut
matching. See :ref:`key_codes` for details on how these are reported. Note that
this flag is a pure enhancement to the form of the escape code used to
represent key events, only key events represented as escape codes due to the
other enhancements in effect will be affected by this enhancement. In other
words, only if a key event was already going to be represented as an escape
code due to one of the other enhancements will this enhancement affect it.

.. _report_all_keys:

Report all keys as escape codes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Key events that generate text, such as plain key presses without modifiers,
result in just the text being sent, in the legacy protocol. There is no way to
be notified of key repeat/release events. These types of events are needed for
some applications, such as games (think of movement using the ``WASD`` keys).

This progressive enhancement (``0b1000``) turns on key reporting even for key
events that generate text. When it is enabled, text will not be sent, instead
only key events are sent. If the text is needed as well, combine with the
Report associated text enhancement below.

Additionally, with this mode, events for pressing modifier keys are reported.
Note that *all* keys are reported as escape codes, including :kbd:`Enter`,
:kbd:`Tab`, :kbd:`Backspace` etc. Note that this enhancement implies all keys
are automatically disambiguated as well, since they are represented in their
canonical escape code form.

.. _report_text:

Report associated text
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This progressive enhancement (``0b10000``) *additionally* causes key events that
generate text to be reported as ``CSI u`` escape codes with the text embedded
in the escape code. See :ref:`text_as_codepoints` above for details on the
mechanism. Note that this flag is an enhancement to :ref:`report_all_keys`
and is undefined if used without it.

.. _detection:

Detection of support for this protocol
------------------------------------------

An application can query the terminal for support of this protocol by sending
the escape code querying for the :ref:`current progressive enhancement
<progressive_enhancement>` status
followed by request for the `primary device attributes
<https://vt100.net/docs/vt510-rm/DA1.html>`__. If an answer for the device
attributes is received without getting back an answer for the progressive
enhancement the terminal does not support this protocol.

.. note::
   Terminal implementations of this protocol are **strongly** encouraged to
   implement all progressive enhancements. It does not make sense to
   implement only a subset. Nonetheless, there are likely to be some terminal
   implementations that do not do so, applications can detect such
   implementations by first setting the desired progressive enhancements and
   then querying for the :ref:`current progressive enhancement <progressive_enhancement>`

Legacy key event encoding
--------------------------------

In the default mode, the terminal uses a legacy encoding for key events. In
this encoding, only key press and repeat events are sent and there is no
way to distinguish between them. Text is sent directly as UTF-8 bytes.

Any key events not described in this section are sent using the standard
``CSI u`` encoding. This includes keys that are not encodable in the legacy
encoding, thereby increasing the space of usable key combinations even without
progressive enhancement.

Legacy functional keys
~~~~~~~~~~~~~~~~~~~~~~~~

These keys are encoded using three schemes::

    CSI number ; modifier ~
    CSI 1 ; modifier {ABCDEFHPQS}
    SS3 {ABCDEFHPQRS}

In the above, if there are no modifiers, the modifier parameter is omitted.
The modifier value is encoded as described in the :ref:`modifiers` section,
above, except that lock keys (such as :kbd:`Num lock` and :kbd:`Caps lock`)
are not encoded as the legacy mode has no encoding for them.

When the second form is used, the number is always ``1`` and must be
omitted if the modifiers field is also absent. The third form becomes the
second form when modifiers are present (``SS3 is the bytes 0x1b 0x4f``).

These sequences must match entries in the terminfo database for maximum
compatibility. The table below lists the key, its terminfo entry name and
the escape code used for it by kitty. A different terminal would use whatever
escape code is present in its terminfo database for the key.
Some keys have an alternate representation when the terminal is in *cursor key
mode* (the ``smkx/rmkx`` terminfo capabilities). This form is used only in
*cursor key mode* and only when no modifiers are present.

.. csv-table:: Legacy functional encoding
   :header: "Name", "Terminfo name", "Escape code"

    "INSERT",    "kich1",      "CSI 2 ~"
    "DELETE",    "kdch1",      "CSI 3 ~"
    "PAGE_UP",   "kpp",        "CSI 5 ~"
    "PAGE_DOWN", "knp",        "CSI 6 ~"
    "UP",        "cuu1,kcuu1", "CSI A, SS3 A"
    "DOWN",      "cud1,kcud1", "CSI B, SS3 B"
    "RIGHT",     "cuf1,kcuf1", "CSI C, SS3 C"
    "LEFT",      "cub1,kcub1", "CSI D, SS3 D"
    "HOME",      "home,khome", "CSI H, SS3 H"
    "END",       "-,kend",     "CSI F, SS3 F"
    "F1",        "kf1",        "SS3 P"
    "F2",        "kf2",        "SS3 Q"
    "F3",        "kf3",        "SS3 R"
    "F4",        "kf4",        "SS3 S"
    "F5",        "kf5",        "CSI 15 ~"
    "F6",        "kf6",        "CSI 17 ~"
    "F7",        "kf7",        "CSI 18 ~"
    "F8",        "kf8",        "CSI 19 ~"
    "F9",        "kf9",        "CSI 20 ~"
    "F10",       "kf10",       "CSI 21 ~"
    "F11",       "kf11",       "CSI 23 ~"
    "F12",       "kf12",       "CSI 24 ~"
    "MENU",      "kf16",       "CSI 29 ~"

There are a few more functional keys that have special cased legacy encodings.
These are present because they are commonly used and for the sake of legacy
terminal applications that get confused when seeing CSI u escape codes:

.. csv-table:: C0 controls
    :header: "Key", "No mods", "Ctrl", "Alt", "Shift", "Ctrl + Shift", "Alt + Shift", "Ctrl + Alt"

    "Enter",     "0xd",  "0xd",  "0x1b 0xd",  "0xd",   "0xd",   "0x1b 0xd",   "0x1b 0xd"
    "Escape",    "0x1b", "0x1b", "0x1b 0x1b", "0x1b",  "0x1b",  "0x1b 0x1b",  "0x1b 0x1b"
    "Backspace", "0x7f", "0x8",  "0x1b 0x7f", "0x7f",  "0x8",   "0x1b 0x7f",  "0x1b 0x8"
    "Tab",       "0x9",  "0x9",  "0x1b 0x9",  "CSI Z", "CSI Z", "0x1b CSI Z", "0x1b 0x9"
    "Space",     "0x20", "0x0",  "0x1b 0x20", "0x20",  "0x0",   "0x1b 0x20",  "0x1b 0x0"

Note that :kbd:`Backspace` and :kbd:`ctrl+Backspace` are swapped in some
terminals, this can be detected using the ``kbs`` terminfo property that
must correspond to the :kbd:`Backspace` key.

All keypad keys are reported as their equivalent non-keypad keys. To
distinguish these, use the :ref:`disambiguate <disambiguate>` flag.

Terminals may choose what they want to do about functional keys that have no
legacy encoding. kitty chooses to encode these using ``CSI u`` encoding even in
legacy mode, so that they become usable even in programs that do not
understand the full kitty keyboard protocol. However, terminals may instead choose to
ignore such keys in legacy mode instead, or have an option to control this behavior.

.. _legacy_text:

Legacy text keys
~~~~~~~~~~~~~~~~~~~

For legacy compatibility, the keys :kbd:`a`-:kbd:`z` :kbd:`0`-:kbd:`9`
:kbd:`\`` :kbd:`-` :kbd:`=` :kbd:`[` :kbd:`]` :kbd:`\\` :kbd:`;` :kbd:`'`
:kbd:`,` :kbd:`.` :kbd:`/` with the modifiers :kbd:`shift`, :kbd:`alt`,
:kbd:`ctrl`, :kbd:`shift+alt`, :kbd:`ctrl+alt` are output using the following
algorithm:

#. If the :kbd:`alt` key is pressed output the byte for ``ESC (0x1b)``
#. If the :kbd:`ctrl` modifier is pressed map the key using the table
   in :ref:`ctrl_mapping`.
#. Otherwise, if the :kbd:`shift` modifier is pressed, output the shifted key,
   for example, ``A`` for ``a`` and ``$`` for ``4``.
#. Otherwise, output the key unmodified

Additionally, :kbd:`ctrl+space` is output as the NULL byte ``(0x0)``.

Any other combination of modifiers with these keys is output as the appropriate
``CSI u`` escape code.

.. csv-table:: Example encodings
   :header: "Key", "Plain", "shift", "alt", "ctrl", "shift+alt", "alt+ctrl", "ctrl+shift"

    "i", "i (105)", "I (73)", "ESC i", "\t (9)", "ESC I", "ESC \t", "CSI 105; 6 u"
    "3", "3 (51)", "# (35)", "ESC 3", "ESC (27)", "ESC #", "ESC ESC", "CSI 51; 6 u"
    ";", "; (59)", ": (58)", "ESC ;", "; (59)", "ESC :", "ESC ;", "CSI 59; 6 u"

.. note::
   Many of the legacy escape codes are ambiguous with multiple different key
   presses yielding the same escape code(s), for example, :kbd:`ctrl+i` is the
   same as :kbd:`tab`, :kbd:`ctrl+m` is the same as :kbd:`Enter`, :kbd:`ctrl+r`
   is the same :kbd:`ctrl+shift+r`, etc. To resolve these use the
   :ref:`disambiguate progressive enhancement <disambiguate>`.


.. _functional:

Functional key definitions
----------------------------

All numbers are in the Unicode Private Use Area (``57344 - 63743``) except
for a handful of keys that use numbers under 32 and 127 (C0 control codes) for legacy
compatibility reasons.

.. {{{
.. start functional key table (auto generated by gen-key-constants.py do not edit)

.. csv-table:: Functional key codes
   :header: "Name", "CSI", "Name", "CSI"

   "ESCAPE", "``27 u``", "ENTER", "``13 u``"
   "TAB", "``9 u``", "BACKSPACE", "``127 u``"
   "INSERT", "``2 ~``", "DELETE", "``3 ~``"
   "LEFT", "``1 D``", "RIGHT", "``1 C``"
   "UP", "``1 A``", "DOWN", "``1 B``"
   "PAGE_UP", "``5 ~``", "PAGE_DOWN", "``6 ~``"
   "HOME", "``1 H or 7 ~``", "END", "``1 F or 8 ~``"
   "CAPS_LOCK", "``57358 u``", "SCROLL_LOCK", "``57359 u``"
   "NUM_LOCK", "``57360 u``", "PRINT_SCREEN", "``57361 u``"
   "PAUSE", "``57362 u``", "MENU", "``57363 u``"
   "F1", "``1 P or 11 ~``", "F2", "``1 Q or 12 ~``"
   "F3", "``13 ~``", "F4", "``1 S or 14 ~``"
   "F5", "``15 ~``", "F6", "``17 ~``"
   "F7", "``18 ~``", "F8", "``19 ~``"
   "F9", "``20 ~``", "F10", "``21 ~``"
   "F11", "``23 ~``", "F12", "``24 ~``"
   "F13", "``57376 u``", "F14", "``57377 u``"
   "F15", "``57378 u``", "F16", "``57379 u``"
   "F17", "``57380 u``", "F18", "``57381 u``"
   "F19", "``57382 u``", "F20", "``57383 u``"
   "F21", "``57384 u``", "F22", "``57385 u``"
   "F23", "``57386 u``", "F24", "``57387 u``"
   "F25", "``57388 u``", "F26", "``57389 u``"
   "F27", "``57390 u``", "F28", "``57391 u``"
   "F29", "``57392 u``", "F30", "``57393 u``"
   "F31", "``57394 u``", "F32", "``57395 u``"
   "F33", "``57396 u``", "F34", "``57397 u``"
   "F35", "``57398 u``", "KP_0", "``57399 u``"
   "KP_1", "``57400 u``", "KP_2", "``57401 u``"
   "KP_3", "``57402 u``", "KP_4", "``57403 u``"
   "KP_5", "``57404 u``", "KP_6", "``57405 u``"
   "KP_7", "``57406 u``", "KP_8", "``57407 u``"
   "KP_9", "``57408 u``", "KP_DECIMAL", "``57409 u``"
   "KP_DIVIDE", "``57410 u``", "KP_MULTIPLY", "``57411 u``"
   "KP_SUBTRACT", "``57412 u``", "KP_ADD", "``57413 u``"
   "KP_ENTER", "``57414 u``", "KP_EQUAL", "``57415 u``"
   "KP_SEPARATOR", "``57416 u``", "KP_LEFT", "``57417 u``"
   "KP_RIGHT", "``57418 u``", "KP_UP", "``57419 u``"
   "KP_DOWN", "``57420 u``", "KP_PAGE_UP", "``57421 u``"
   "KP_PAGE_DOWN", "``57422 u``", "KP_HOME", "``57423 u``"
   "KP_END", "``57424 u``", "KP_INSERT", "``57425 u``"
   "KP_DELETE", "``57426 u``", "KP_BEGIN", "``1 E or 57427 ~``"
   "MEDIA_PLAY", "``57428 u``", "MEDIA_PAUSE", "``57429 u``"
   "MEDIA_PLAY_PAUSE", "``57430 u``", "MEDIA_REVERSE", "``57431 u``"
   "MEDIA_STOP", "``57432 u``", "MEDIA_FAST_FORWARD", "``57433 u``"
   "MEDIA_REWIND", "``57434 u``", "MEDIA_TRACK_NEXT", "``57435 u``"
   "MEDIA_TRACK_PREVIOUS", "``57436 u``", "MEDIA_RECORD", "``57437 u``"
   "LOWER_VOLUME", "``57438 u``", "RAISE_VOLUME", "``57439 u``"
   "MUTE_VOLUME", "``57440 u``", "LEFT_SHIFT", "``57441 u``"
   "LEFT_CONTROL", "``57442 u``", "LEFT_ALT", "``57443 u``"
   "LEFT_SUPER", "``57444 u``", "LEFT_HYPER", "``57445 u``"
   "LEFT_META", "``57446 u``", "RIGHT_SHIFT", "``57447 u``"
   "RIGHT_CONTROL", "``57448 u``", "RIGHT_ALT", "``57449 u``"
   "RIGHT_SUPER", "``57450 u``", "RIGHT_HYPER", "``57451 u``"
   "RIGHT_META", "``57452 u``", "ISO_LEVEL3_SHIFT", "``57453 u``"
   "ISO_LEVEL5_SHIFT", "``57454 u``"

.. end functional key table
.. }}}

.. note::
    The escape codes above of the form ``CSI 1 letter`` will omit the
    ``1`` if there are no modifiers, since ``1`` is the default value.

.. note::
   The original version of this specification allowed F3 to be encoded as both
   CSI R and CSI ~. However, CSI R conflicts with the Cursor Position Report,
   so it was removed.

.. _ctrl_mapping:

Legacy :kbd:`ctrl` mapping of ASCII keys
------------------------------------------

When the :kbd:`ctrl` key and another key are pressed on the keyboard, terminals
map the result *for some keys* to a *C0 control code* i.e. an value from ``0 -
31``. This mapping was historically dependent on the layout of hardware
terminal keyboards and is not specified anywhere, completely. The best known
reference is `Table 3-5 in the VT-100 docs <https://vt100.net/docs/vt100-ug/chapter3.html>`_.

The table below provides a mapping that is a commonly used superset of the table above.
Any ASCII keys not in the table must be left untouched by :kbd:`ctrl`.

.. {{{
.. start ctrl mapping (auto generated by gen-key-constants.py do not edit)
.. csv-table:: Emitted bytes when :kbd:`ctrl` is held down and a key is pressed
   :header: "Key", "Byte", "Key", "Byte", "Key", "Byte"

   "SPC ", "0", "/", "31", "0", "48"
   "1", "49", "2", "0", "3", "27"
   "4", "28", "5", "29", "6", "30"
   "7", "31", "8", "127", "9", "57"
   "?", "127", "@", "0", "[", "27"
   "\\", "28", "]", "29", "^", "30"
   "_", "31", "a", "1", "b", "2"
   "c", "3", "d", "4", "e", "5"
   "f", "6", "g", "7", "h", "8"
   "i", "9", "j", "10", "k", "11"
   "l", "12", "m", "13", "n", "14"
   "o", "15", "p", "16", "q", "17"
   "r", "18", "s", "19", "t", "20"
   "u", "21", "v", "22", "w", "23"
   "x", "24", "y", "25", "z", "26"
   "~", "30"

.. end ctrl mapping
.. }}}

.. _fixterms_bugs:

Bugs in fixterms
-------------------

The following is a list of errata in the `original fixterms proposal
<http://www.leonerd.org.uk/hacks/fixterms/>`_, corrected in this
specification.

* No way to disambiguate :kbd:`Esc` key presses, other than using 8-bit controls
  which are undesirable for other reasons

* Incorrectly claims special keys are sometimes encoded using ``CSI letter`` encodings when it
  is actually ``SS3 letter`` in all terminals newer than a VT-52, which is
  pretty much everything.

* :kbd:`ctrl+shift+tab` should be ``CSI 9 ; 6 u`` not ``CSI 1 ; 5 Z``
  (shift+tab is not a separate key from tab)

* No support for the :kbd:`super` modifier.

* Makes no mention of cursor key mode and how it changes encodings

* Incorrectly encoding shifted keys when shift modifier is used, for instance,
  for :kbd:`ctrl+shift+i` is encoded as :kbd:`ctrl+I`.

* No way to have non-conflicting escape codes for :kbd:`alt+letter`,
  :kbd:`ctrl+letter`, :kbd:`ctrl+alt+letter` key presses

* No way to specify both shifted and unshifted keys for robust shortcut
  matching (think matching :kbd:`ctrl+shift+equal` and :kbd:`ctrl+plus`)

* No way to specify alternate layout key. This is useful for keyboard layouts
  such as Cyrillic where you want the shortcut :kbd:`ctrl+c` to work when
  pressing the :kbd:`ctrl+С` on the keyboard.

* No way to report repeat and release key events, only key press events

* No way to report key events for presses that generate text, useful for
  gaming. Think of using the :kbd:`WASD` keys to control movement.

* Only a small subset of all possible functional keys are assigned numbers.

* Claims the ``CSI u`` escape code has no fixed meaning, but has been used for
  decades as ``SCORC`` for instance by xterm and ansi.sys and `DECSMBV
  <https://vt100.net/docs/vt510-rm/DECSMBV.html>`_ by the VT-510 hardware
  terminal. This doesn't really matter since these uses are for communication
  to the terminal not from the terminal.

* Handwaves that :kbd:`ctrl` *tends to* mask with ``0x1f``. In actual fact it
  does this only for some keys. The action of :kbd:`ctrl` is not specified and
  varies between terminals, historically because of different keyboard layouts.


Why xterm's modifyOtherKeys should not be used
---------------------------------------------------

* Does not support release events

* Does not fix the issue of :kbd:`Esc` key presses not being distinguishable from
  escape codes.

* Does not fix the issue of some keypresses generating identical bytes and thus
  being indistinguishable

* There is no robust way to query it or manage its state from a program running
  in the terminal.

* No support for shifted keys.

* No support for alternate keyboard layouts.

* No support for modifiers beyond the basic four.

* No support for lock keys like Num lock and Caps lock.

* Is completely unspecified. The most discussion of it available anywhere is
  `here <https://invisible-island.net/xterm/modified-keys.html>`__
  And it contains no specification of what numbers to assign to what function
  keys beyond running a Perl script on an X11 system!!
```

## File: docs/kittens_intro.rst
```rst
.. _kittens:

Extend with kittens
-----------------------

.. toctree::
   :hidden:
   :glob:

   kittens/icat
   kittens/diff
   kittens/unicode_input
   kittens/themes
   kittens/choose-fonts
   kittens/hints
   kittens/quick-access-terminal
   kittens/choose-files
   kittens/panel
   kittens/remote_file
   kittens/hyperlinked_grep
   kittens/transfer
   kittens/ssh
   kittens/custom
   kittens/*

|kitty| has a framework for easily creating terminal programs that make use of
its advanced features. These programs are called kittens. They are used both to
add features to |kitty| itself and to create useful standalone programs.
Some prominent kittens:

:doc:`icat <kittens/icat>`
    Display images in the terminal.


:doc:`diff <kittens/diff>`
    A fast, side-by-side diff for the terminal with syntax highlighting and
    images.


:doc:`Unicode input <kittens/unicode_input>`
    Easily input arbitrary Unicode characters in |kitty| by name or hex code.


:doc:`Themes <kittens/themes>`
    Preview and quick switch between over three hundred color themes.


:doc:`Fonts <kittens/choose-fonts>`
    Preview, fine-tune and quick switch the fonts used by kitty.


:doc:`Hints <kittens/hints>`
    Select and open/paste/insert arbitrary text snippets such as URLs,
    filenames, words, lines, etc. from the terminal screen.


:doc:`Quick access terminal <kittens/quick-access-terminal>`
    Get access to a quick access floating, semi-transparent kitty window
    with a single keypress.


:doc:`Panel <kittens/panel>`
    Draw the desktop wallpaper or docks and panels using arbitrary
    terminal programs.


:doc:`Choose files <kittens/choose-files>`
    Preview and select files at the speed of thought


:doc:`Remote file <kittens/remote_file>`
    Edit, open, or download remote files over SSH easily, by simply clicking on
    the filename.


:doc:`Transfer files <kittens/transfer>`
    Transfer files and directories seamlessly and easily from remote machines
    over your existing SSH sessions with a simple command.


:doc:`Hyperlinked grep <kittens/hyperlinked_grep>`
    Search your files using `ripgrep <https://github.com/BurntSushi/ripgrep>`__
    and open the results directly in your favorite editor in the terminal,
    at the line containing the search result, simply by clicking on the result
    you want.


:doc:`Broadcast <kittens/broadcast>`
    Type in one :term:`kitty window <window>` and have it broadcast to all (or a
    subset) of other :term:`kitty windows <window>`.


:doc:`SSH <kittens/ssh>`
    SSH with automatic :ref:`shell integration <shell_integration>`, connection
    re-use for low latency and easy cloning of local shell and editor
    configuration to the remote host.


:doc:`Clipboard <kittens/clipboard>`
    Copy/paste to the clipboard from shell scripts, even over SSH.

You can also :doc:`Learn to create your own kittens <kittens/custom>`.
```

## File: docs/launch.rst
```rst
The :command:`launch` command
--------------------------------

.. program:: launch


|kitty| has a :code:`launch` action that can be used to run arbitrary programs
in new windows/tabs. It can be mapped to user defined shortcuts in
:file:`kitty.conf`. It is very powerful and allows sending the contents of the
current window to the launched program, as well as many other options.

In the simplest form, you can use it to open a new kitty window running the
shell, as shown below::

    map f1 launch

To run a different program simply pass the command line as arguments to launch::

    map f1 launch vim path/to/some/file

To open a new window with the same working directory as the currently active
window::

    map f1 launch --cwd=current

To open the new window in a new tab::

    map f1 launch --type=tab

To run multiple commands in a shell, use::

    map f1 launch sh -c "ls && exec zsh"

To pass the contents of the current screen and scrollback to the started
process::

    map f1 launch --stdin-source=@screen_scrollback less

There are many more powerful options, refer to the complete list below.

.. note::
    To avoid duplicating launch actions with frequently used parameters, you can
    use :opt:`action_alias` to define launch action aliases. For example::

        action_alias launch_tab launch --cwd=current --type=tab
        map f1 launch_tab vim
        map f2 launch_tab emacs

    The :kbd:`F1` key will now open :program:`vim` in a new tab with the current
    windows working directory.


The piping environment
--------------------------

When using :option:`launch --stdin-source`, the program to which the data is
piped has a special environment variable declared, :envvar:`KITTY_PIPE_DATA`
whose contents are::

   KITTY_PIPE_DATA={scrolled_by}:{cursor_x},{cursor_y}:{lines},{columns}

where ``scrolled_by`` is the number of lines kitty is currently scrolled by,
``cursor_(x|y)`` is the position of the cursor on the screen with ``(1,1)``
being the top left corner and ``{lines},{columns}`` being the number of rows
and columns of the screen.


Special arguments
-------------------

There are a few special placeholder arguments that can be specified as part of
the command line:


``@selection``
    Replaced by the currently selected text.

``@active-kitty-window-id``
    Replaced by the id of the currently active kitty window.

``@line-count``
    Replaced by the number of lines in STDIN. Only present when passing some
    data to STDIN.

``@input-line-number``
    Replaced by the number of lines a pager should scroll to match the current
    scroll position in kitty. See :opt:`scrollback_pager` for details.

``@scrolled-by``
    Replaced by the number of lines kitty is currently scrolled by.

``@cursor-x``
    Replaced by the current cursor x position with 1 being the leftmost cell.

``@cursor-y``
    Replaced by the current cursor y position with 1 being the topmost cell.

``@first-line-on-screen``
    Replaced by the first line on screen. Can be used for pager positioning.

``@last-line-on-screen``
    Replaced by the last line on screen. Can be used for pager positioning.


For example::

    map f1 launch my-program @active-kitty-window-id


.. _watchers:

Watching launched windows
---------------------------

The :option:`launch --watcher` option allows you to specify Python functions
that will be called at specific events, such as when the window is resized or
closed. Note that you can also specify watchers that are loaded for all windows,
via :opt:`watcher`. To create a watcher, specify the path to a Python module
that specifies callback functions for the events you are interested in, for
create :file:`~/.config/kitty/mywatcher.py` and use :option:`launch --watcher` = :file:`mywatcher.py`:

.. code-block:: python

    # ~/.config/kitty/mywatcher.py
    from typing import Any

    from kitty.boss import Boss
    from kitty.window import Window


    def on_load(boss: Boss, data: dict[str, Any]) -> None:
        # This is a special function that is called just once when this watcher
        # module is first loaded, can be used to perform any initialization/one
        # time setup. Any exceptions in this function are printed to kitty's
        # STDERR but otherwise ignored.
        ...

    def on_resize(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # Here data will contain old_geometry and new_geometry
        # Note that resize is also called the first time a window is created
        # which can be detected as old_geometry will have all zero values, in
        # particular, old_geometry.xnum and old_geometry.ynum will be zero.
        ...

    def on_focus_change(boss: Boss, window: Window, data: dict[str, Any])-> None:
        # Here data will contain focused
        ...

    def on_close(boss: Boss, window: Window, data: dict[str, Any])-> None:
        # called when window is closed, typically when the program running in
        # it exits
        ...

    def on_set_user_var(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # called when a "user variable" is set or deleted on a window. Here
        # data will contain key and value
        ...

    def on_title_change(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # called when the window title is changed on a window. Here
        # data will contain title and from_child. from_child will be True
        # when a title change was requested via escape code from the program
        # running in the terminal
        ...

    def on_cmd_startstop(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # called when the shell starts/stops executing a command. Here
        # data will contain is_start, cmdline and time.
        ...

    def on_color_scheme_preference_change(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # called when the color scheme preference of this window changes from
        # light to dark or vice versa. data contains is_dark and via_escape_code
        # the latter will be true if the color scheme was changed via escape
        # code received from the program running in the window
        ...

    def on_tab_bar_dirty(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # called when any changes happen to the tab bar, such a new tabs being
        # created, tab titles changing, tabs moving, etc. Useful to display the
        # tab bar externally to kitty. This is called even if the tab bar is
        # hidden. Note that this is called only in *global watchers*, that is
        # watchers defined in kitty.conf or using the --watcher command line
        # flag. data contains tab_manager which is the object responsible for
        # managing all tabs in a single OS Window.
        ...


Every callback is passed a reference to the global ``Boss`` object as well as
the ``Window`` object the action is occurring on. The ``data`` object is a dict
that contains event dependent data. You have full access to kitty internals in
the watcher scripts, however kitty internals are not documented/stable so for
most things you are better off using the kitty :doc:`Remote control API </remote-control>`.
Simply call :code:`boss.call_remote_control()`, with the same arguments you
would pass to ``kitten @``. For example:

.. code-block:: python

    def on_resize(boss: Boss, window: Window, data: dict[str, Any]) -> None:
        # send some text to the resized window
        boss.call_remote_control(window, ('send-text', f'--match=id:{window.id}', 'hello world'))

Run, ``kitten @ --help`` in a kitty terminal, to see all the remote control
commands available to you.


Finding executables
-----------------------

When you specify a command to run as just a name rather than an absolute path,
it is searched for in the system-wide :envvar:`PATH` environment variable. Note
that this **may not** be the value of :envvar:`PATH` inside a shell, as shell
startup scripts often change the value of this variable. If it is not found
there, then a system specific list of default paths is searched. If it is still
not found, then your shell is run and the value of :envvar:`PATH` inside the
shell is used.

See :opt:`exe_search_path` for details and how to control this.

Syntax reference
------------------

.. include:: /generated/launch.rst
```

## File: docs/layouts.rst
```rst
Arrange windows
-------------------

kitty has the ability to define its own windows that can be tiled next to each
other in arbitrary arrangements, based on *Layouts*, see below for examples:


.. figure:: screenshots/screenshot.png
    :alt: Screenshot, showing three programs in the 'Tall' layout
    :align: center
    :width: 100%

    Screenshot, showing :program:`vim`, :program:`tig` and :program:`git`
    running in |kitty| with the *Tall* layout


.. figure:: screenshots/splits.png
    :alt: Screenshot, showing windows in the 'Splits' layout
    :align: center
    :width: 100%

    Screenshot, showing windows with arbitrary arrangement in the *Splits*
    layout


There are many different layouts available. They are all enabled by default, you
can switch layouts using :ac:`next_layout` (:sc:`next_layout` by default). To
control which layouts are available use :opt:`enabled_layouts`, the first listed
layout becomes the default. Individual layouts and how to use them are described
below.


The Stack Layout
------------------

This is the simplest layout. It displays a single window using all available
space, other windows are hidden behind it. This layout has no options::

    enabled_layouts stack


The Tall Layout
------------------

Displays one (or optionally more) full-height windows on the left half of the
screen. Remaining windows are tiled vertically on the right half of the screen.
There are options to control how the screen is split horizontally ``bias``
(an integer between ``10`` and ``90``) and options to control how many
full-height windows there are ``full_size`` (a positive integer). The
``mirrored`` option when set to ``true`` will cause the full-height windows to
be on the right side of the screen instead of the left. The syntax
for the options is::

    enabled_layouts tall:bias=50;full_size=1;mirrored=false

    ┌──────────────┬───────────────┐
    │              │               │
    │              │               │
    │              │               │
    │              ├───────────────┤
    │              │               │
    │              │               │
    │              │               │
    │              ├───────────────┤
    │              │               │
    │              │               │
    │              │               │
    └──────────────┴───────────────┘

In addition, you can map keys to increase or decrease the number of full-height
windows, or toggle the mirrored setting, for example::

   map ctrl+[ layout_action decrease_num_full_size_windows
   map ctrl+] layout_action increase_num_full_size_windows
   map ctrl+/ layout_action mirror toggle
   map ctrl+y layout_action mirror true
   map ctrl+n layout_action mirror false

You can also map a key to change the bias by providing a list of percentages
and it will rotate through the list as you press the key. If you only provide
one number it'll toggle between that percentage and 50, for example::

   map ctrl+. layout_action bias 50 62 70
   map ctrl+, layout_action bias 62

The Fat Layout
----------------

Displays one (or optionally more) full-width windows on the top half of the
screen. Remaining windows are tiled horizontally on the bottom half of the
screen. There are options to control how the screen is split vertically ``bias``
(an integer between ``10`` and ``90``) and options to control how many
full-width windows there are ``full_size`` (a positive integer). The
``mirrored`` option when set to ``true`` will cause the full-width windows to be
on the bottom of the screen instead of the top. The syntax for the options is::

    enabled_layouts fat:bias=50;full_size=1;mirrored=false

    ┌──────────────────────────────┐
    │                              │
    │                              │
    │                              │
    │                              │
    ├─────────┬──────────┬─────────┤
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    └─────────┴──────────┴─────────┘


This layout also supports the same layout actions as the *Tall* layout, shown above.


The Grid Layout
--------------------

Display windows in a balanced grid with all windows the same size except the
last column if there are not enough windows to fill the grid. This layout has no
options::

    enabled_layouts grid

    ┌─────────┬──────────┬─────────┐
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    ├─────────┼──────────┼─────────┤
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    └─────────┴──────────┴─────────┘


.. _splits_layout:

The Splits Layout
--------------------

This is the most flexible layout. You can create any arrangement of windows
by splitting existing windows repeatedly. To best use this layout you should
define a few extra key bindings in :file:`kitty.conf`::

    # Create a new window splitting the space used by the existing one so that
    # the two windows are placed one above the other
    map f5 launch --location=hsplit

    # Create a new window splitting the space used by the existing one so that
    # the two windows are placed side by side
    map f6 launch --location=vsplit

    # Create a new window splitting the space used by the existing one so that
    # the two windows are placed side by side if the existing window is wide or
    # one above the other if the existing window is tall.
    map f4 launch --location=split

    # Rotate the current split, changing its split axis from vertical to
    # horizontal or vice versa
    map f7 layout_action rotate

    # Move the active window in the indicated direction
    map shift+up move_window up
    map shift+left move_window left
    map shift+right move_window right
    map shift+down move_window down

    # Move the active window to the indicated screen edge
    map ctrl+shift+up layout_action move_to_screen_edge top
    map ctrl+shift+left layout_action move_to_screen_edge left
    map ctrl+shift+right layout_action move_to_screen_edge right
    map ctrl+shift+down layout_action move_to_screen_edge bottom

    # Switch focus to the neighboring window in the indicated direction
    map ctrl+left neighboring_window left
    map ctrl+right neighboring_window right
    map ctrl+up neighboring_window up
    map ctrl+down neighboring_window down

    # Set the bias of the split containing the currently focused window. The
    # currently focused window will take up the specified percent of its parent
    # window's size.
    map ctrl+. layout_action bias 80


Windows can be resized using :ref:`window_resizing`. You can swap the windows
in a split using the ``rotate`` action with an argument of ``180`` and rotate
and swap with an argument of ``270``.

This layout takes one option, ``split_axis`` that controls whether new windows
are placed into vertical or horizontal splits when a :option:`--location
<launch --location>` is not specified. A value of ``horizontal`` (same as
``--location=vsplit``) means when a new split is created the two windows will
be placed side by side and a value of ``vertical`` (same as
``--location=hsplit``) means the two windows will be placed one on top of the
other. A value of ``auto`` means the axis of the split is chosen automatically
(same as ``--location=split``). By default::

    enabled_layouts splits:split_axis=horizontal

    ┌──────────────┬───────────────┐
    │              │               │
    │              │               │
    │              │               │
    │              ├───────┬───────┤
    │              │       │       │
    │              │       │       │
    │              │       │       │
    │              ├───────┴───────┤
    │              │               │
    │              │               │
    │              │               │
    └──────────────┴───────────────┘

.. versionadded:: 0.17.0
    The Splits layout


The Horizontal Layout
------------------------

All windows are shown side by side. This layout has no options::

    enabled_layouts horizontal

    ┌─────────┬──────────┬─────────┐
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    │         │          │         │
    └─────────┴──────────┴─────────┘


The Vertical Layout
-----------------------

All windows are shown one below the other. This layout has no options::

    enabled_layouts vertical

    ┌──────────────────────────────┐
    │                              │
    │                              │
    │                              │
    ├──────────────────────────────┤
    │                              │
    │                              │
    │                              │
    ├──────────────────────────────┤
    │                              │
    │                              │
    │                              │
    └──────────────────────────────┘


.. _window_resizing:

Resizing windows
------------------

You can resize windows inside layouts. Press :sc:`start_resizing_window` (also
:kbd:`⌘+r` on macOS) to enter resizing mode and follow the on-screen
instructions. In a given window layout only some operations may be possible for
a particular window. For example, in the *Tall* layout you can make the first
window wider/narrower, but not taller/shorter. Note that what you are resizing
is actually not a window, but a row/column in the layout, all windows in that
row/column will be resized.

You can also define shortcuts in :file:`kitty.conf` to make the active window
wider, narrower, taller, or shorter by mapping to the :ac:`resize_window`
action, for example::

   map ctrl+left resize_window narrower
   map ctrl+right resize_window wider
   map ctrl+up resize_window taller
   map ctrl+down resize_window shorter 3
   # reset all windows in the tab to default sizes
   map ctrl+home resize_window reset

The :ac:`resize_window` action has a second optional argument to control
the resizing increment (a positive integer that defaults to 1).

Some layouts take options to control their behavior. For example, the *Fat*
and *Tall* layouts accept the ``bias`` and ``full_size`` options to control
how the available space is split up. To specify the option, in :opt:`kitty.conf
<enabled_layouts>` use::

    enabled_layouts tall:bias=70;full_size=2

This will have ``2`` instead of a single tall window, that occupy ``70%``
instead of ``50%`` of available width. ``bias`` can be any number between ``10``
and ``90``.

Writing a new layout only requires about two hundred lines of code, so if there
is some layout you want, take a look at one of the existing layouts in the
`layout <https://github.com/kovidgoyal/kitty/tree/master/kitty/layout>`__
package and submit a pull request!
```

## File: docs/mapping.rst
```rst
:orphan:

Making your keyboard dance
==============================

.. highlight:: conf

kitty has extremely powerful facilities for mapping keyboard actions.
Things like combining actions, multi-key mappings, modal mappings,
mappings that send arbitrary text, and mappings dependent on the program
currently running in kitty.

Let's start with the basics. You can map a key press to an action in kitty using
the following syntax::

    map ctrl+a new_window_with_cwd

This will map the key press :kbd:`Ctrl+a` to open a new :term:`window`
with the working directory set to the working directory of the current window.
This is the basic operation of the map directive, the tip of the iceberg, for
more read the sections below.


Combining multiple actions on a single keypress
-----------------------------------------------------

Multiple actions can be combined on a single keypress, like a macro. To do this
map the key press to the :ac:`combine` action::

    map key combine <separator> action1 <separator> action2 <separator> action3 ...

For example::

    map kitty_mod+e combine : new_window : next_layout

This will create a new window and switch to the next available layout. You can
also run arbitrarily powerful scripts on a key press. There are two major
techniques for doing this, using remote control scripts or using kittens.

Remote control scripts
^^^^^^^^^^^^^^^^^^^^^^^^^

These can be written in any language and use the "kitten" binary to control
kitty via its extensive :doc:`Remote control <remote-control>` API. First,
if you just want to run a single remote control command on a key press,
you can just do::

    map f1 remote_control set-spacing margin=30

This will run the ``set-spacing`` command, changing window margins to 30 pixels. For
more complex scripts, write a script file in any language you like and save it
somewhere, preferably in the kitty configuration directory. Do not forget to make it
executable. In the script file you run remote control commands by running the
"kitten" binary, for example:

.. code-block:: sh

   #!/bin/sh

   kitten @ set-spacing margin=30
   kitten @ new_window
   ...

The script can perform arbitrarily complex logic and actions, limited only by
the remote control API, that you can browse by running ``kitten @ --help``.
To run the script you created on a key press, use::

    map f1 remote_control_script /path/to/myscript


Kittens
^^^^^^^^^^^^^

Here, kittens refer to Python scripts. The scripts have two parts, one that
runs as a regular command line program inside a kitty window to, for example,
ask the user for some input and a second part that runs inside the kitty
process itself and can perform any operation on the kitty UI, which is itself
implemented in Python. However, the kitty internal API is not documented and
can (very rarely) change, so kittens are harder to get started with than remote
control scripts. To run a kitten on a key press::

    map f1 kitten mykitten.py

Many of kitty's features are themselves implemented as kittens, for example,
:doc:`/kittens/unicode_input`, :doc:`/kittens/hints` and
:doc:`/kittens/themes`. To learn about writing your own kittens, see
:doc:`/kittens/custom`.

Syntax for specifying keys
-----------------------------

A mapping maps a key press to some action. In their most basic form, keypresses
are :code:`modifier+key`. Keys are identified simply by their lowercase Unicode
characters. For example: :code:`a` for the :kbd:`A` key, :code:`[` for the left
square bracket key, etc.  For functional keys, such as :kbd:`Enter` or
:kbd:`Escape`, the names are present at :ref:`Functional key definitions
<functional>`. For modifier keys, the names are :kbd:`ctrl` (:kbd:`control`,
:kbd:`⌃`), :kbd:`shift` (:kbd:`⇧`), :kbd:`alt` (:kbd:`opt`, :kbd:`option`,
:kbd:`⌥`), :kbd:`super` (:kbd:`cmd`, :kbd:`command`, :kbd:`⌘`).

Additionally, you can use the name :opt:`kitty_mod` as a modifier, the default
value of which is :kbd:`ctrl+shift`. The default kitty shortcuts are defined
using this value, so by changing it in :file:`kitty.conf` you can change
all the modifiers used by all the default shortcuts.

On Linux, you can also use XKB names for functional keys that don't have kitty
names. See :link:`XKB keys
<https://github.com/xkbcommon/libxkbcommon/blob/master/include/xkbcommon/xkbcommon-keysyms.h>`
for a list of key names. The name to use is the part after the :code:`XKB_KEY_`
prefix. Note that you can only use an XKB key name for keys that are not known
as kitty keys.

Finally, you can use raw system key codes to map keys, again only for keys that
are not known as kitty keys. To see the system key code for a key, start kitty
with the :option:`kitty --debug-input` option, kitty will output some debug text
for every key event. In that text look for :code:`native_code`, the value
of that becomes the key name in the shortcut. For example:

.. code-block:: none

    on_key_input: glfw key: 0x61 native_code: 0x61 action: PRESS mods: none text: 'a'

Here, the key name for the :kbd:`A` key is :code:`0x61` and you can use it with::

    map ctrl+0x61 something

This maps :kbd:`Ctrl+A` to something.


Multi-key mappings
--------------------

A mapping in kitty can involve pressing multiple keys in sequence, with the
syntax shown below::

    map key1>key2>key3 action

For example::

    map ctrl+f>2 set_font_size 20

The default mappings to run the :doc:`hints kitten </kittens/hints>` to select text on the screen are
examples of multi-key mappings.

Unmapping default shortcuts
-----------------------------

kitty comes with dozens of default keyboard mappings for common operations. See
:doc:`actions` for the full list of actions and the default shortcuts that map
to them. You can unmap an individual shortcut, so that it is passed on to the
program running inside kitty, by mapping it to nothing, for example::

    map kitty_mod+enter

This unmaps the default shortcut :sc:`new_window` to open a new window. Almost
all default shortcuts are of the form ``modifier + key`` where the
modifier defaults to :kbd:`Ctrl+Shift` and can be changed using the :opt:`kitty_mod` setting
in :file:`kitty.conf`.

If you want to clear all default shortcuts, you can use
:opt:`clear_all_shortcuts` in :file:`kitty.conf`.

If you would like kitty to completely ignore a key event, not even sending it to
the program running in the terminal, map it to :ac:`discard_event`::

    map kitty_mod+f1 discard_event

.. _conditional_mappings:

Conditional mappings depending on the state of the focused window
----------------------------------------------------------------------

Sometimes, you may want different mappings to be active when running a
particular program in kitty, perhaps because it has some native functionality
that duplicates kitty functions or there is a conflict, etc. kitty has the
ability to create mappings that work only when the currently focused window
matches some criteria, such as when it has a particular title or user variable.

Let's see some examples::

    map --when-focus-on title:keyboard.protocol kitty_mod+t

This will cause :kbd:`kitty_mod+t` (the default shortcut for opening a new tab)
to be unmapped only when the focused window
has :code:`keyboard protocol` in its title. Run the show-key kitten as::

    kitten show-key -m kitty

Press :kbd:`ctrl+shift+t` and instead of a new tab opening, you will
see the key press being reported by the kitten. :code:`--when-focus-on` can test
the focused window using very powerful criteria, see :ref:`search_syntax` for
details. A more practical example unmaps the key when the focused window is
running an editor::

    map --when-focus-on var:in_editor kitty_mod+c

In order to make this work, you need to configure your editor as shown below:

.. tab:: vim

   In :file:`~/.vimrc` add:
    .. code-block:: vim

        let &t_ti = &t_ti . "\033]1337;SetUserVar=in_editor=MQo\007"
        let &t_te = &t_te . "\033]1337;SetUserVar=in_editor\007"

.. tab:: neovim

   In :file:`~/.config/nvim/init.lua` add:

    .. code-block:: lua

        vim.api.nvim_create_autocmd({ "VimEnter", "VimResume", "UIEnter" }, {
            group = vim.api.nvim_create_augroup("KittySetVarVimEnter", { clear = true }),
            callback = function()
                if vim.api.nvim_ui_send then
                    vim.api.nvim_ui_send("\x1b]1337;SetUserVar=in_editor=MQo\007")
                else
                    io.stdout:write("\x1b]1337;SetUserVar=in_editor=MQo\007")
                end
            end,
        })

        vim.api.nvim_create_autocmd({ "VimLeave", "VimSuspend" }, {
            group = vim.api.nvim_create_augroup("KittyUnsetVarVimLeave", { clear = true }),
            callback = function()
                if vim.api.nvim_ui_send then
                    vim.api.nvim_ui_send("\x1b]1337;SetUserVar=in_editor=MQo\007")
                else
                    io.stdout:write("\x1b]1337;SetUserVar=in_editor\007")
                end
            end,
        })

These cause the editor to set the :code:`in_editor` variable in kitty and unset it when exiting.
As a result, the :kbd:`ctrl+shift+c` key will be passed to the editor instead of
copying to clipboard. In the editor, you can map it to copy to the clipboard,
thereby allowing use of a common shortcut both inside and outside the editor
for copying to clipboard.

.. note::

   When using multi-key mappings, of the form :kbd:`k1>k2` or similar, the
   condition applies to the first key and you can have only one condition per
   key, the last in kitty.conf wins. In particular, this means you cannot have
   multiple conditions applying to multi-key mappings with the same first key
   and you cannot have mappings with and without conditions applying to multi-keys
   with the same first key.

Sending arbitrary text or keys to the program running in kitty
--------------------------------------------------------------------------------

This is accomplished by using ``map`` with :sc:`send_text <send_text>` in :file:`kitty.conf`.
For example::

    map f1 send_text normal,application Hello, world!

Now, pressing :kbd:`f1` will cause ``Hello, world!`` to show up at your shell
prompt. To have the shell execute a command sent via ``send_text`` you need to
also simulate pressing the enter key which is ``\r``. For example::

    map f1 send_text normal,application echo Hello, world!\r

Now, if you press :kbd:`f1` when at shell prompt it will run the ``echo Hello,
world!`` command.

To have one key press send another key press, use :ac:`send_key`::

    map alt+s send_key ctrl+s

This causes the program running in kitty to receive the :kbd:`ctrl+s` key when
you press the :kbd:`alt+s` key. To see this in action, run::

    kitten show-key -m kitty

Which will print out what key events it receives.

.. _modal_mappings:

Modal mappings
--------------------------

kitty has the ability, like vim, to use *modal* key maps. Except that unlike
vim it allows you to define your own arbitrary number of modes. To create a new
mode, use ``map --new-mode <my mode name> <shortcut to enter mode>``. For
example, lets create a mode to manage windows: switching focus, moving the window, etc.::

    # Create a new "manage windows" mode (mw)
    map --new-mode mw kitty_mod+f7

    # Switch focus to the neighboring window in the indicated direction using arrow keys
    map --mode mw left neighboring_window left
    map --mode mw right neighboring_window right
    map --mode mw up neighboring_window up
    map --mode mw down neighboring_window down

    # Move the active window in the indicated direction
    map --mode mw shift+up move_window up
    map --mode mw shift+left move_window left
    map --mode mw shift+right move_window right
    map --mode mw shift+down move_window down

    # Resize the active window
    map --mode mw n resize_window narrower
    map --mode mw w resize_window wider
    map --mode mw t resize_window taller
    map --mode mw s resize_window shorter

    # Exit the manage window mode
    map --mode mw esc pop_keyboard_mode

Now, if you run kitty as:

.. code-block:: sh

    kitty -o enabled_layouts=vertical --session <(echo "launch\nlaunch\nlaunch")

Press :kbd:`Ctrl+Shift+F7` to enter the mode and then press the up and
down arrow keys to focus the next/previous window. Press :kbd:`Shift+Up` or
:kbd:`Shift+Down` to move the active window up and down. Press :kbd:`t` to make
the active window taller and :kbd:`s` to make it shorter. To exit the mode
press :kbd:`Esc`.

Pressing an unknown key while in a custom keyboard mode by default
beeps. This can be controlled by the ``map --on-unknown`` option as shown
below::

    # Beep on unknown keys
    map --new-mode XXX --on-unknown beep ...
    # Ignore unknown keys silently
    map --new-mode XXX --on-unknown ignore ...
    # Beep and exit the keyboard mode on unknown key
    map --new-mode XXX --on-unknown end ...
    # Pass unknown keys to the program running in the active window
    map --new-mode XXX --on-unknown passthrough ...

When a key matches an action in a custom keyboard mode, the action is performed
and the custom keyboard mode remains in effect. If you would rather have the
keyboard mode end after the action you can use ``map --on-action`` as shown
below::

    # Have this keyboard mode automatically exit after performing any action
    map --new-mode XXX --on-action end ...


All mappable actions
------------------------

There is a list of :doc:`all mappable actions <actions>`.

Debugging mapping issues
------------------------------

To debug mapping issues, kitty has several facilities. First, when you run
kitty with the ``--debug-input`` command line flag it outputs details
about all key events it receives form the system and how they are handled.

To see what key events are sent to applications, run kitty like this::

    kitty kitten show-key

Press the keys you want to debug and the kitten will print out the bytes it
receives. Note that this uses the legacy terminal keyboard protocol that does
not support all keys and key events. To debug the :doc:`full kitty keyboard
protocol that <keyboard-protocol>` that is nowadays being adopted by more and
more programs, use::

    kitty kitten show-key -m kitty
```

## File: docs/marks.rst
```rst
Mark text on screen
---------------------


kitty has the ability to mark text on the screen based on regular expressions.
This can be useful to highlight words or phrases when browsing output from long
running programs or similar. Lets start with a few examples:

Examples
----------

Suppose we want to be able to highlight the word :code:`ERROR` in the current
window. Add the following to :file:`kitty.conf`::

    map f1 toggle_marker text 1 ERROR

Now when you press :kbd:`F1`, all instances of the word :code:`ERROR` will be
highlighted. To turn off the highlighting, press :kbd:`F1` again.
If you want to make it case-insensitive, use::

    map f1 toggle_marker itext 1 ERROR

To make it match only complete words, use::

    map f1 toggle_marker regex 1 \\bERROR\\b

Suppose you want to highlight both :code:`ERROR` and :code:`WARNING`, case
insensitively::

    map f1 toggle_marker iregex 1 \\bERROR\\b 2 \\bWARNING\\b

kitty supports up to 3 mark groups (the numbers in the commands above). You
can control the colors used for these groups in :file:`kitty.conf` with::

    mark1_foreground red
    mark1_background gray
    mark2_foreground green
    ...


.. note::
    For performance reasons, matching is done per line only, and only when that
    line is altered in any way. So you cannot match text that stretches across
    multiple lines.


Creating markers dynamically
---------------------------------

If you want to create markers dynamically rather than pre-defining them in
:file:`kitty.conf`, you can do so as follows::

    map f1 create_marker
    map f2 remove_marker

Then pressing :kbd:`F1` will allow you to enter the marker definition and set it
and pressing :kbd:`F2` will remove the marker. :ac:`create_marker` accepts the
same syntax as :ac:`toggle_marker` above. Note that while creating markers, the
prompt has history so you can easily re-use previous marker expressions.

You can also use the facilities for :doc:`remote-control` to dynamically add or
remove markers.


Scrolling to marks
--------------------

kitty has a :ac:`scroll_to_mark` action to scroll to the next line that contains
a mark. You can use it by mapping it to some shortcut in :file:`kitty.conf`::

    map ctrl+p scroll_to_mark prev
    map ctrl+n scroll_to_mark next

Then pressing :kbd:`Ctrl+P` will scroll to the first line in the scrollback
buffer above the current top line that contains a mark. Pressing :kbd:`Ctrl+N`
will scroll to show the first line below the current last line that contains
a mark. If you wish to jump to a mark of a specific type, you can add that to
the mapping::

    map ctrl+1 scroll_to_mark prev 1

Which will scroll only to marks of type 1.


The full syntax for creating marks
-------------------------------------

The syntax of the :ac:`toggle_marker` action is::

    toggle_marker <marker-type> <specification>

Here :code:`marker-type` is one of:

* :code:`text` - Simple substring matching
* :code:`itext` - Case-insensitive substring matching
* :code:`regex` - A Python regular expression
* :code:`iregex` - A case-insensitive Python regular expression
* :code:`function` - An arbitrary function defined in a Python file, see :ref:`marker_funcs`.

.. _marker_funcs:

Arbitrary marker functions
-----------------------------

You can create your own marker functions. Create a Python file named
:file:`mymarker.py` and in it create a :code:`marker` function. This function
receives the text of the line as input and must yield three numbers,
the starting character position, the ending character position and the mark
group (1-3). For example:

.. code-block::

    def marker(text):
        # Function to highlight the letter X
        for i, ch in enumerate(text):
            if ch.lower() == 'x':
                yield i, i, 3


Save this file somewhere and in :file:`kitty.conf`, use::

    map f1 toggle_marker function /path/to/mymarker.py

If you save the file in the :ref:`kitty config directory <confloc>`, you can
use::

    map f1 toggle_marker function mymarker.py
```

## File: docs/misc-protocol.rst
```rst
Miscellaneous protocol extensions
==============================================

These are a few small protocol extensions kitty implements, primarily for use
by its own kitten, they are documented here for completeness.


Simple save/restore of all terminal modes
--------------------------------------------

XTerm has the XTSAVE/XTRESTORE escape codes to save and restore terminal
private modes. However, they require specifying an explicit list of modes to
save/restore. kitty extends this protocol to specify that when no modes are
specified, all side-effect free modes should be saved/restored. By side-effects
we mean things that can affect other terminal state such as cursor position or
screen contents. Examples of modes that have side effects are: `DECOM
<https://vt100.net/docs/vt510-rm/DECOM.html>`__ and `DECCOLM
<https://vt100.net/docs/vt510-rm/DECCOLM.html>`__.

This allows TUI applications to easily save and restore emulator state without
needing to maintain lists of modes.


Independent control of bold and faint SGR properties
-------------------------------------------------------

In common terminal usage, bold is set via SGR 1 and faint by SGR 2. However,
there is only one number to reset these attributes, SGR 22, which resets both.
There is no way to reset one and not the other. kitty uses 221 and 222 to reset
bold and faint independently.

.. _mouse_leave_window:

Reporting when the mouse leaves the window
----------------------------------------------

kitty extends the SGR Pixel mouse reporting protocol created by xterm to
also report when the mouse leaves the window. This event is delivered
encoded as a normal SGR pixel event except that the eight bit is set on the
first number. Additionally, bit 5 is set to indicate this is a motion related event.
The remaining bits 1-7 (except 5) are used to encode button and modifier information.
When bit 8 is set it means the event is a mouse has left the window event,
and all other bits should be ignored. The pixel position values must also
be ignored as they may not be accurate.

An escape code to move the contents of the screen into the scrollback
-------------------------------------------------------------------------------------

The escape code is ``\x1b [ 22 J`` (ignoring spaces present for clarity). It
moves all screen contents (text and images) into the scrollback leaving the
screen in the same state as it would be if the standard screen clear escape
code had been used ``\x1b [ 2 J``.


kitty specific private escape codes
---------------------------------------

These are a family of escape codes used by kitty for various things including
remote control. They are all DCS (Device Control String) escape codes starting
with ``\x1b P @ kitty-`` (ignoring spaces present for clarity).
```

## File: docs/multiple-cursors-protocol.rst
```rst
The multiple cursors protocol
==============================================

.. versionadded:: 0.43.0

Many editors support something called *multiple cursors* in which you can make
the same changes at multiple locations in a file and the editor shows you
cursors at each of the locations. In a terminal context editors typically
implement this by showing some Unicode glyph at each location instead of the
actual cursor. This is sub-optimal since actual cursors implemented by the
terminal have many niceties like smooth animation [anim]_, auto adjust colors [rv]_,
etc. To address this and other use cases, this protocol allows terminal programs to
request that the terminal display multiple cursors at specific locations on the
screen.

Quickstart
----------------

An example, showing how to use the protocol:

.. code-block:: sh

    # Show cursors of the same shape as the main cursor at y=4, x=5
    printf "\e[>29;2:4:5 q"
    # Show more cursors on the seventh line, of various shapes, the underline shape is shown twice
    printf "\e[>1;2:7:1 q\e[>2;2:7:3 q\e[>3;2:7:5;2:7:7 q"


The escape code to show a cursor has the following structure (ignore spaces
they are present for readability only)::

    CSI > SHAPE;CO-ORD TYPE : CO-ORDINATES ; CO-ORD TYPE : CO-ORDINATES ... TRAILER

Here ``CSI`` is the two bytes ESC (``0x1b``) and [ (``0x5b``). ``SHAPE`` can be
one of:

* ``0``: No cursor
* ``1``: Block cursor
* ``2``: Beam cursor
* ``3``: Underline cursor
* ``29``: Follow the shape of the main cursor
* ``30``: Change the color of text under extra cursors
* ``40``: Change the color of extra cursors
* ``100``: Used for querying currently set cursors

``CO-ORD TYPE`` can be one of:

* ``0``: This refers to the position of the main cursor and has no following
  co-ordinates.

* ``2``: In this case the following co-ordinates are pairs of numbers pointing
  to cells in the form ``y:x`` with the origin in the top left corner at
  ``1,1``. There can be any number of pairs, the terminal must treat each pair
  as a new location to set a cursor.

* ``4``: In this case the following co-ordinates are sets of four numbers that
  define a rectangle in the same co-ordinate system as above of the form:
  ``top:left:bottom:right``. The shape is set on every cell in the rectangle
  from the top left cell to the bottom right cell, inclusive. If no numbers
  are provided, the rectangle is the full screen. There can be any number of
  rectangles, the terminal must treat each set of four numbers as a new
  rectangle.

The sequence of ``CO-ORD TYPE : CO-ORDINATES`` can be repeated any number of
times separated by ``;``. The ``SHAPE`` will be set on the cells indicated by
each such group. For example: ``-1;2:3:4;4:5:6:7:8`` will set the shape ``-1``
at the cell ``(3, 2)`` and in the rectangle ``(6, 5)`` to ``(8, 7)`` inclusive.

Finally, the ``TRAILER`` terminates the sequence and is the bytes SPACE
(``0x20``) and q (``0x71``).

Terminals **must** ignore cells that fall outside the screen. That means, for
rectangle co-ordinates only the intersection of the rectangle with the screen
must be considered, and point co-ordinates that fall outside of the screen are
simply ignored, with no effect.

Terminals **must** ignore extra co-ordinates, that means if an odd number of
co-ordinates are specified for type ``2`` the last co-ordinate is ignored.
Similarly for type ``4`` if the number of co-ordinates is not a multiple of
four, the last ``1 <= n <= 3`` co-ordinates are ignored, as if they were not
specified.

Querying for support
-------------------------

A terminal program can query the terminal emulator for support of this
protocol by sending the escape code::

    CSI > TRAILER

In this case a supporting terminal must reply with::

    CSI > 1;2;3;29;30;40;100;101 TRAILER

Here, the list of numbers indicates the cursor shapes and other operations
the terminal supports and can be any subset of the above. No numbers
indicates the protocol is not supported. To avoid having to wait with a
timeout for a response from the terminal, the client should send this
query code immediately followed by a request for the
`primary device attributes <https://vt100.net/docs/vt510-rm/DA1.html>`_.
If the terminal responds with an answer for the device attributes without
an answer for the *query* the terminal emulator does not support this protocol at all.

Terminals **must** respond to these queries in FIFO order, so that
multiplexers that split a single screen know which split to send responses too.

Clearing previously set multi-cursors
------------------------------------------

The cursor at a cell is cleared by setting its shape to ``0``.
The most common operation is to clear all previously set multi-cursors. This is
easily done using the *rectangle* co-ordinate system above, like this::

    CSI > 0;4 TRAILER

For more precise control different co-ordinate types can be used. This is
particularly important for multiplexers that split up the screen and therefore
need to re-write these escape codes.

.. _extra_cursor_color:

Changing the color of extra cursors
---------------------------------------

In order to visually distinguish extra cursors from the main cursor, it is
possible to specify a color pair for extra cursors. Note that for performance
reasons, there is only a single color pair that all extra cursors share.
The color pair consists of the cursor color and the color for text in the cell
the cursor is on.

To change this color pair use an escape code of the form::

    CSI > WHICH ; COLOR_SPACE : COLOR_PARAMETER1 : COLOR_PARAMETER2 : ... TRAILER

Here, ``WHICH`` is ``30`` to set the color of text under the cursor and ``40``
to set the color of the cursor itself (these numbers mimic the SGR codes for
foreground and background respectively).

The ``COLOR_SPACE`` parameter sets the type of color, it can take values:

``0`` - unset color is same as for main cursor. No color parameters.
``1`` - *special* which typically means some kind of reverse video effect, see below
``2`` - sRGB color, with three color parameters, red, green and blue as numbers
from 0 to 255
``5`` - Indexed color with one color parameter which is an index into the color
table from 0 to 255

When the cursor color is set to *special* via ``40`` it means the block cursor
must be rendered with a reverse video effect where the cursor color becomes the
foreground color of the cell under the cursor and the foreground color of the
cell becomes its background color. Implementations are free to adjust these
colors to ensure suitable contrast levels. In this case the text color set by
``30`` must be ignored.

When the cursor color is not set to *special* but the text color via ``30`` is
set to special, then that means the foreground color of the cell with the
cursor must be changed to its background color for a partial reverse video
effect.

When unset, aka, set to ``0`` the cursors must be the same color as the main
cursor. In particular if the main color is using a reverse video effect, the
extra cursors must use the exact same colors as the main cursor, not the colors
of the cells they are on.

Querying for already set cursors
--------------------------------------

Programs can ask the terminal what extra cursors are currently set, by sending
the escape code::

    CSI > 100 TRAILER

The terminal must respond with **one** escape code::

    CSI > 100; SHAPE:CO-ORDINATE TYPE:CO-ORDINATES ; ... TRAILER

Here, the ``SHAPE:CO-ORDINATE TYPE:CO-ORDINATES`` block can be repeated any
number of times, separated by ``;``. This response gives the set of shapes and
positions currently active. If no cursors are currently active, there will be
no blocks, just an empty response of the form::

    CSI > 100 TRAILER

Again, terminals **must** respond in FIFO order so that multiplexers know where
to direct the responses.

Querying for extra cursor colors
-------------------------------------

Programs can ask the terminal what cursor colors are currently set, by sending
escape code::

    CSI > 101 TRAILER

The terminal must respond with **one** escape code::

    CSI > 101 ; 30 : COLOR_SPACE : COLOR_PARAMETERS ; 40 : COLOR_SPACE : COLOR_PARAMETERS TRAILER

The number and type of ``COLOR_PARAMETERS`` depends on the preceding
``COLOR_SPACE`` and can be omitted for some ``COLOR_SPACE`` values. See the
section :ref:`extra_cursor_color` for details.


Interaction with other terminal controls and state
-------------------------------------------------------

**The main cursor**
    The extra cursors must all have the same color and opacity and blink state
    as the main cursor. The main cursor's visibility must not affect the
    visibility of the extra cursors. Their visibility and shape are controlled
    only by this protocol.

**Clearing the screen**
    The escape codes used to clear the screen (`ED <https://vt100.net/docs/vt510-rm/ED.html>`__)
    with parameters 2, 3 and 22 must remove all extra cursors,
    this is so that the clear command can be used by users to clear the screen of extra cursors.

**Reset***
    This must remove all extra cursors.

**Alternate screen***
    Switching between the main and alternate screens must remove all extra
    cursors.

**Scrolling**
    The index (IND) and reverse index (RI) escape codes that cause screen
    contents to scroll into scrollback or off screen must not affect
    the extra cursors in any way. They remain at exactly the same position.
    It is up to applications to manage extra cursor positions when using these
    escape codes if needed. There are not a lot of use cases for scrolling
    extra cursors with screen content, since extra cursors are meant to be
    ephemeral and on screen only, not in scrollback. This allows terminals
    to avoid the extra overhead of adjusting positions of the extra cursors
    on every scroll.


Footnotes
-------------

.. [anim] kitty allows the cursor blink to be :opt:`animated
   <cursor_blink_interval>` using any CSS easing function. This cannot be
   implemented using fake cursors.

.. [rv] kitty has a special "reverse video" color mode for cursors where the
   color of the cursor and the text under the cursor is adjusted based on the
   color of the cell under the cursor. This also cannot be implemented using
   fake cursors.
```

## File: docs/open_actions.rst
```rst
Scripting the mouse click
======================================================

|kitty| has support for :term:`terminal hyperlinks <hyperlinks>`. These are
generated by many terminal programs, such as ``ls``, ``gcc``, ``systemd``,
:ref:`tool_mcat`, etc. You can customize exactly what happens when clicking on
these hyperlinks in |kitty|.

You can tell kitty to take arbitrarily many, complex actions when a link is
clicked. Let us illustrate with some examples, first. Create the file
:file:`~/.config/kitty/open-actions.conf` with the following:

.. code:: conf

    # Open any image in the full kitty window by clicking on it
    protocol file
    mime image/*
    action launch --type=overlay kitten icat --hold -- ${FILE_PATH}

Now, run ``ls --hyperlink=auto`` in kitty and click on the filename of an
image, holding down :kbd:`ctrl+shift`. It will be opened over the current
window. Press any key to close it.

.. note::

    The :program:`ls` comes with macOS does not support hyperlink, you need to
    install `GNU Coreutils <https://www.gnu.org/software/coreutils/>`__. If you
    install it via `Homebrew <https://formulae.brew.sh/formula/coreutils>`__, it
    will be :program:`gls`.

Each entry in :file:`open-actions.conf` consists of one or more
:ref:`matching_criteria`, such as ``protocol`` and ``mime`` and one or more
``action`` entries. In the example above kitty uses the :doc:`launch <launch>`
action which can be used to run external programs. Entries are separated by
blank lines.

Actions are very powerful, anything that you can map to a key combination in
:file:`kitty.conf` can be used as an action. You can specify more than one
action per entry if you like, for example:


.. code:: conf

    # Tail a log file (*.log) in a new OS Window and reduce its font size
    protocol file
    ext log
    action launch --title ${FILE} --type=os-window tail -f -- ${FILE_PATH}
    action change_font_size current -2


In the launch specification you can expand environment variables, as shown in
the examples above. In addition to regular environment variables, there are
some special variables, documented below:

``URL``
    The full URL being opened

``FILE_PATH``
    The path portion of the URL (unquoted)

``FILE``
    The file portion of the path of the URL (unquoted)

``FRAGMENT``
    The fragment (unquoted), if any of the URL or the empty string.

``NETLOC``
    The net location aka hostname (unquoted), if any of the URL or the empty string.

``URL_PATH``
    The path, query and fragment portions of the URL, without any
    unquoting.

``EDITOR``
    The terminal based text editor. The configured :opt:`editor` in
    :file:`kitty.conf` is preferred.

``SHELL``
    The path to the shell. The configured :opt:`shell` in :file:`kitty.conf` is
    preferred, without arguments.

.. note::
   You can use the :opt:`action_alias` option just as in :file:`kitty.conf` to
   define aliases for frequently used actions.


.. _matching_criteria:

Matching criteria
------------------

An entry in :file:`open-actions.conf` must have one or more matching criteria.
URLs that match all criteria for an entry will trigger that entry's actions.
Processing stops at the first matching entry, so put more specific matching
criteria at the start of the list. Entries in the file are separated by blank
lines. The various available criteria are:

``protocol``
    A comma separated list of protocols, for example: ``http, https``. If
    absent, there is no constraint on protocol.

``url``
    A regular expression that must match against the entire (unquoted) URL

``fragment_matches``
    A regular expression that must match against the fragment (part after #) in
    the URL

``mime``
    A comma separated list of MIME types, for example: ``text/*, image/*,
    application/pdf``. You can add MIME types to kitty by creating a file named
    :file:`mime.types` in the :ref:`kitty configuration directory <confloc>`.
    Useful if your system MIME database does not have definitions you need. This
    file is in the standard format of one definition per line, like:
    ``text/plain rst md``. Note that the MIME type for directories is
    ``inode/directory``. MIME types are detected based on file extension, not
    file contents.

``ext``
    A comma separated list of file extensions, for example: ``jpeg, tar.gz``

``file``
    A shell glob pattern that must match the filename, for example:
    ``image-??.png``


.. _launch_actions:

Scripting the opening of files with kitty
-------------------------------------------------------

On macOS you can use :guilabel:`Open With` in Finder or drag and drop files and
URLs onto the kitty dock icon to open them with kitty. Similarly on Linux, you
can associate certain files types to open in kitty. The default actions are:

* Open text files in your editor and images using the icat kitten.
* Run shell scripts in a shell
* Open SSH urls using the ssh command

These actions can also be executed from the command line by running::

    kitty +open file_or_url another_url ...

    # macOS only
    open -a kitty.app file_or_url another_url ...

Since macOS lacks an official interface to set default URL scheme handlers,
kitty has a command you can use for it. The first argument for is the URL
scheme, and the second optional argument is the bundle id of the app, which
defaults to kitty, if not specified. For example:

.. code-block:: sh

    # Set kitty as the handler for ssh:// URLs
    kitty +runpy 'from kitty.fast_data_types import cocoa_set_url_handler; import sys; cocoa_set_url_handler(*sys.argv[1:]); print("OK")' ssh
    # Set someapp as the handler for xyz:// URLs
    kitty +runpy 'from kitty.fast_data_types import cocoa_set_url_handler; import sys; cocoa_set_url_handler(*sys.argv[1:]); print("OK")' xyz someapp.bundle.identifier

You can customize these actions by creating a :file:`launch-actions.conf` file
in the :ref:`kitty config directory <confloc>`, just like the
:file:`open-actions.conf` file above. For example:

.. literalinclude:: ../kitty/open_actions.py
   :language: conf
   :start-at: # Open script files
   :end-before: '''.splitlines()))
```

## File: docs/overview.rst
```rst
Overview
==============

Design philosophy
-------------------

|kitty| is designed for power keyboard users. To that end all its controls work
with the keyboard (although it fully supports mouse interactions as well). Its
configuration is a simple, human editable, single file for easy reproducibility
(I like to store configuration in source control).

The code in |kitty| is designed to be simple, modular and hackable. It is
written in a mix of C (for performance sensitive parts), Python (for easy
extensibility and flexibility of the UI) and Go (for the command line
:term:`kittens`).  It does not depend on any large and complex UI toolkit,
using only OpenGL for rendering everything.

Finally, |kitty| is designed from the ground up to support all modern terminal
features, such as Unicode, true color, bold/italic fonts, text formatting, etc.
It even extends existing text formatting escape codes, to add support for
features not available elsewhere, such as colored and styled (curly) underlines.
One of the design goals of |kitty| is to be easily extensible so that new
features can be added in the future with relatively little effort.

.. include:: basic.rst


Configuring kitty
-------------------

|kitty| is highly configurable, everything from keyboard shortcuts to painting
frames-per-second. Press :sc:`edit_config_file` in kitty to open its fully
commented sample config file in your text editor. For details see the
:doc:`configuration docs <conf>`.

.. toctree::
   :hidden:

   conf


.. _layouts:

Layouts
----------

A :term:`layout` is an arrangement of multiple :term:`kitty windows <window>`
inside a top-level :term:`OS window <os_window>`. The layout manages all its
windows automatically, resizing and moving them as needed. You can create a new
:term:`window` using the :sc:`new_window` key combination.

Currently, there are seven layouts available:

* **Fat** -- One (or optionally more) windows are shown full width on the top,
  the rest of the windows are shown side-by-side on the bottom

* **Grid** -- All windows are shown in a grid

* **Horizontal** -- All windows are shown side-by-side

* **Splits** -- Windows arranged in arbitrary patterns created using horizontal
  and vertical splits

* **Stack** -- Only a single maximized window is shown at a time

* **Tall** -- One (or optionally more) windows are shown full height on the
  left, the rest of the windows are shown one below the other on the right

* **Vertical** -- All windows are shown one below the other

By default, all layouts are enabled and you can switch between layouts using
the :sc:`next_layout` key combination. You can also create shortcuts to select
particular layouts, and choose which layouts you want to enable, see
:ref:`conf-kitty-shortcuts.layout` for examples. The first layout listed in
:opt:`enabled_layouts` becomes the default layout.

For more details on the layouts and how to use them see :doc:`the documentation
<layouts>`.

.. toctree::
   :hidden:

   layouts

Extending kitty
------------------

kitty has a powerful framework for scripting. You can create small terminal
programs called :doc:`kittens <kittens_intro>`. These can be used to add features
to kitty, for example, :doc:`editing remote files <kittens/remote_file>` or
:doc:`inputting Unicode characters <kittens/unicode_input>`. They can also be
used to create programs that leverage kitty's powerful features, for example,
:doc:`viewing images <kittens/icat>` or :doc:`diffing files with image support
<kittens/diff>`.

You can :doc:`create your own kittens to scratch your own itches
<kittens/custom>`.

For a list of all the builtin kittens, run ``kitten`` in kitty, or to browse
some of the more prominent ones, see :ref:`see here <kittens>`.

Additionally, you can use the :ref:`watchers <Watchers>` framework
to create Python scripts that run in response to various events such as windows
being resized, closing, having their titles changed, etc.

Finally, there is remote control which allows you to control kitty from
anywhere, even across a network! See below for more about remote control.

.. toctree::
   :hidden:

   kittens_intro


Remote control
------------------

|kitty| has a very powerful system that allows you to control it from the
:doc:`shell prompt, even over SSH <remote-control>`. You can change colors,
fonts, open new :term:`windows <window>`, :term:`tabs <tab>`, set their titles,
change window layout, get text from one window and send text to another, etc.
The possibilities are endless. See the :doc:`tutorial <remote-control>` to get
started.

.. toctree::
   :hidden:

   remote-control


Sessions
------------------

You can control the :term:`tabs <tab>`, :term:`kitty window <window>` layout,
working directory, startup programs, etc. by creating a *session* file and using
the :option:`kitty --session` command line flag or the :opt:`startup_session`
option in :file:`kitty.conf`. You can also easily switch between sessions with
a keypress. See :doc:`sessions` for details.


Creating tabs/windows
-------------------------------

kitty can be told to run arbitrary programs in new :term:`tabs <tab>`,
:term:`windows <window>` or :term:`overlays <overlay>` at a keypress.
To learn how to do this, see :doc:`here <launch>`.

.. toctree::
   :hidden:

   launch


Mouse features
-------------------

* You can click on a URL to open it in a browser.
* You can double click to select a word and then drag to select more words.
* You can triple click to select a line and then drag to select more lines.
* You can triple click while holding :kbd:`Ctrl+Alt` to select from clicked
  point to end of line.
* You can right click to extend a previous selection.
* You can hold down :kbd:`Ctrl+Alt` and drag with the mouse to select in
  columns.
* Selecting text automatically copies it to the primary clipboard (on platforms
  with a primary clipboard).
* You can middle click to paste from the primary clipboard (on platforms with a
  primary clipboard).
* You can right click while holding :kbd:`Ctrl+Shift` to open the output of the
  clicked on command in a pager (requires :ref:`shell_integration`)
* You can select text with kitty even when a terminal program has grabbed the
  mouse by holding down the :kbd:`Shift` key

All these actions can be customized in :file:`kitty.conf` as described
:ref:`here <conf-kitty-mouse.mousemap>`.

You can also customize what happens when clicking on :term:`hyperlinks` in
kitty, having it open files in your editor, download remote files, open things
in your browser, etc. For details, see :doc:`here <open_actions>`.

.. toctree::
   :hidden:

   open_actions

Font control
-----------------

|kitty| has extremely flexible and powerful font selection features. You can
specify individual families for the regular, bold, italic and bold+italic fonts.
You can even specify specific font families for specific ranges of Unicode
characters. This allows precise control over text rendering. It can come in
handy for applications like powerline, without the need to use patched fonts.
See the various font related configuration directives in
:ref:`conf-kitty-fonts`.


.. _scrollback:

The scrollback buffer
-----------------------

|kitty| supports scrolling back to view history, just like most terminals. You
can use either keyboard shortcuts or the mouse scroll wheel to do so. |kitty|
displays an interactive :opt:`scrollbar` along the right edge
of the window that shows your current position in the scrollback. You can click
and drag the scrollbar to quickly navigate through the history.

However, |kitty| has an extra, neat feature. Sometimes you need to explore the scrollback
buffer in more detail, maybe search for some text or refer to it side-by-side
while typing in a follow-up command. |kitty| allows you to do this by pressing
the :sc:`show_scrollback` shortcut, which will open the scrollback buffer in
your favorite pager program (which is :program:`less` by default). Colors and
text formatting are preserved. You can explore the scrollback buffer comfortably
within the pager.

Additionally, you can pipe the contents of the scrollback buffer to an
arbitrary, command running in a new :term:`window`, :term:`tab` or
:term:`overlay`. For example::

   map f1 launch --stdin-source=@screen_scrollback --stdin-add-formatting less +G -R

Would open the scrollback buffer in a new :term:`window` when you press the
:kbd:`F1` key. See :sc:`show_scrollback <show_scrollback>` for details.

If you want to use it with an editor such as :program:`nvim` to get more powerful
features, see for example, `kitty-scrollback.nvim
<https://github.com/mikesmithgh/kitty-scrollback.nvim>`__ or `kitty-grab <https://github.com/yurikhan/kitty_grab>`__
or see more tips for using various editor programs, in :iss:`this thread <719>`.

If you wish to store very large amounts of scrollback to view using the piping
or :sc:`show_scrollback <show_scrollback>` features, you can use the
:opt:`scrollback_pager_history_size` option.


Integration with shells
---------------------------------

kitty has the ability to integrate closely within common shells, such as `zsh
<https://www.zsh.org/>`__, `fish <https://fishshell.com>`__ and `bash
<https://www.gnu.org/software/bash/>`__ to enable features such as jumping to
previous prompts in the scrollback, viewing the output of the last command in
:program:`less`, using the mouse to move the cursor while editing prompts, etc.
See :doc:`shell-integration` for details.

.. toctree::
   :hidden:

   shell-integration

.. _cpbuf:

Multiple copy/paste buffers
-----------------------------

In addition to being able to copy/paste from the system clipboard, in |kitty|
you can also setup an arbitrary number of copy paste buffers. To do so, simply
add something like the following to your :file:`kitty.conf`::

   map f1 copy_to_buffer a
   map f2 paste_from_buffer a

This will allow you to press :kbd:`F1` to copy the current selection to an
internal buffer named ``a`` and :kbd:`F2` to paste from that buffer. The buffer
names are arbitrary strings, so you can define as many such buffers as you need.


Marks
-------------

kitty has the ability to mark text on the screen based on regular expressions.
This can be useful to highlight words or phrases when browsing output from long
running programs or similar. To learn how this feature works, see :doc:`marks`.

.. toctree::
   :hidden:

   marks
```

## File: docs/performance.rst
```rst
Performance
===================

The main goals for |kitty| performance are user perceived latency while typing
and "smoothness" while scrolling as well as CPU usage. |kitty| tries hard to
find an optimum balance for these. To that end it keeps a cache of each
rendered glyph in video RAM so that font rendering is not a bottleneck.
Interaction with child programs takes place in a separate thread from
rendering, to improve smoothness. Parsing of the byte stream is done using
`vector CPU instructions
<https://en.wikipedia.org/wiki/Single_instruction,_multiple_data>`__ for
maximum performance. Updates to the screen typically require sending just a few
bytes to the GPU.

There are two config options you can tune to adjust the performance,
:opt:`repaint_delay` and :opt:`input_delay`. These control the artificial delays
introduced into the render loop to reduce CPU usage. See
:ref:`conf-kitty-performance` for details. See also the :opt:`sync_to_monitor`
option to further decrease latency at the cost of some `screen tearing
<https://en.wikipedia.org/wiki/Screen_tearing>`__ while scrolling.

Benchmarks
-------------

Measuring terminal emulator performance is fairly subtle, there are three main
axes on which performance is measured: Energy usage for typical tasks,
Keyboard to screen latency, and throughput (processing large amounts of data).

Keyboard to screen latency
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This is measured either with dedicated hardware, or software such as `Typometer
<https://pavelfatin.com/typometer/>`__. Third party measurements comparing
kitty with other terminal emulators on various systems show kitty has best in
class keyboard to screen latency.

Note that to minimize latency at the expense of more energy usage, use the
following settings in kitty.conf::

    input_delay 0
    repaint_delay 2
    sync_to_monitor no
    wayland_enable_ime no

`Hardware based measurement on macOS
<https://thume.ca/2020/05/20/making-a-latency-tester/>`__ show that kitty and
Apple's Terminal.app share the crown for best latency. These
measurements were done with :opt:`input_delay` at its default value of ``3 ms``
which means kitty's actual numbers would be even lower.

`Typometer based measurements on Linux
<https://github.com/kovidgoyal/kitty/issues/2701#issuecomment-911089374>`__
show that kitty has far and away the best latency of the terminals tested.

.. _throughput:

Throughput
^^^^^^^^^^^^^^^^

kitty has a builtin kitten to measure throughput, it works by dumping large
amounts of data of different types into the tty device and measuring how fast
the terminal parses and responds to it. The measurements below were taken with
the same font, font size and window size for all terminals, and default
settings, on the same computer. They clearly show kitty has the fastest
throughput. To run the tests yourself, run ``kitten __benchmark__`` in the
terminal emulator you want to test, where the kitten binary is part of the
kitty install.

The numbers are megabytes per second of data that the terminal
processes. Measurements were taken under Linux/X11 with an ``AMD Ryzen 7 PRO
5850U``. Entries are in order of decreasing performance. kitty is twice
as fast as the next best.

================   ======  ======= ===== ====== =======
Terminal           ASCII   Unicode CSI   Images Average
================   ======  ======= ===== ====== =======
kitty 0.33         121.8   105.0   59.8  251.6  134.55
gnometerm 3.50.1   33.4    55.0    16.1  142.8  61.83
alacritty 0.13.1   43.1    46.5    32.5  94.1   54.05
wezterm 20230712   16.4    26.0    11.1  140.5  48.5
xterm 389          47.7    18.3    0.6   56.3   30.72
konsole 23.08.04   25.2    37.7    23.6  23.4   27.48
alacritty+tmux     30.3    7.8     14.7  46.1   24.73
================   ======  ======= ===== ====== =======

In this table, each column represents different types of data. The CSI column
is for data consisting of a mix of typical formatting escape codes and some
ASCII only text.

.. note::

   By default, the benchmark kitten suppresses actual rendering, to better
   focus on parser speed, you can pass it the ``--render`` flag to not suppress
   rendering. However, modern terminals typically render asynchronously,
   therefore the numbers are not really useful for comparison, as it is just a
   game about how much input to *batch* before rendering the next frame.
   However, even with rendering enabled kitty is still faster than all the
   rest. For brevity those numbers are not included.

.. note::

   foot, iterm2 and Terminal.app are left out as they do not run under X11.
   Alacritty+tmux is included just to show the effect of putting a terminal
   multiplexer into the mix (halving throughput) and because alacritty isn't
   remotely comparable to any of the other terminals feature wise without tmux.

.. note::

   konsole, gnome-terminal and xterm do not support the `Synchronized update
   <https://gitlab.com/gnachman/iterm2/-/wikis/synchronized-updates-spec>`__
   escape code used to suppress rendering, if and when they gain support for it
   their numbers are likely to improve by ``20 - 50%``, depending on how well they
   implement it.


Energy usage
^^^^^^^^^^^^^^^^^

Sadly, I do not have the infrastructure to measure actual energy usage so CPU
usage will have to stand in for it. Here are some CPU usage numbers for the
task of scrolling a file continuously in :program:`less`. The CPU usage is for
the terminal process and X together and is measured using :program:`htop`. The
measurements are taken at the same font and window size for all terminals on a
``Intel(R) Core(TM) i7-4820K CPU @ 3.70GHz`` CPU with a ``Advanced Micro
Devices, Inc. [AMD/ATI] Cape Verde XT [Radeon HD 7770/8760 / R7 250X]`` GPU.

==============   =========================
Terminal         CPU usage (X + terminal)
==============   =========================
|kitty|          6 - 8%
xterm            5 - 7% (but scrolling was extremely janky)
termite          10 - 13%
urxvt            12 - 14%
gnome-terminal   15 - 17%
konsole          29 - 31%
==============   =========================

As you can see, |kitty| uses much less CPU than all terminals, except xterm, but
its scrolling "smoothness" is much better than that of xterm (at least to my,
admittedly biased, eyes).

Instrumenting kitty
-----------------------

You can generate detailed per-function performance data using
`gperftools <https://github.com/gperftools/gperftools>`__. Build |kitty| with
``make profile``. Run kitty and perform the task you want to analyse, for
example, scrolling a large file with :program:`less`. After you quit, function
call statistics will be displayed in *KCachegrind*. Hence, profiling is best done
on Linux which has these tools easily available.
```

## File: docs/pipe.rst
```rst
:orphan:

Working with the screen and history buffer contents
======================================================

.. warning::
    The pipe action has been deprecated in favor of the
    :doc:`launch <launch>` action which is more powerful.

You can pipe the contents of the current screen and history buffer as
:file:`STDIN` to an arbitrary program using the ``pipe`` function. The program
can be displayed in a kitty window or overlay.

For example, the following in :file:`kitty.conf` will open the scrollback
buffer in less in an overlay window, when you press :kbd:`F1`::

    map f1 pipe @ansi overlay less +G -R

The syntax of the ``pipe`` function is::

   pipe <input placeholder> <destination window type> <command line to run>


The piping environment
--------------------------

The program to which the data is piped has a special environment variable
declared, ``KITTY_PIPE_DATA`` whose contents are::

   KITTY_PIPE_DATA={scrolled_by}:{cursor_x},{cursor_y}:{lines},{columns}

where ``scrolled_by`` is the number of lines kitty is currently scrolled by,
``cursor_(x|y)`` is the position of the cursor on the screen with ``(1,1)``
being the top left corner and ``{lines},{columns}`` being the number of rows
and columns of the screen.

You can choose where to run the pipe program:

``overlay``
   An overlay window over the current kitty window

``window``
   A new kitty window

``os_window``
   A new top-level window

``tab``
   A new window in a new tab

``clipboard, primary``
   Copy the text directly to the clipboard. In this case the specified program
   is not run, so use some dummy program name for it.

``none``
   Run it in the background


Input placeholders
--------------------

There are various different kinds of placeholders

``@selection``
   Plain text, currently selected text

``@text``
   Plain text, current screen + scrollback buffer

``@ansi``
   Text with formatting, current screen + scrollback buffer

``@screen``
   Plain text, only current screen

``@ansi_screen``
   Text with formatting, only current screen

``@alternate``
   Plain text, secondary screen. The secondary screen is the screen not currently displayed. For
   example if you run a fullscreen terminal application, the secondary screen will
   be the screen you return to when quitting the application.

``@ansi_alternate``
   Text with formatting, secondary screen.

``@alternate_scrollback``
   Plain text, secondary screen + scrollback, if any.

``@ansi_alternate_scrollback``
   Text with formatting, secondary screen + scrollback, if any.

``none``
   No input


You can also add the suffix ``_wrap`` to the placeholder, in which case kitty
will insert the carriage return at every line wrap location (where long lines
are wrapped at screen edges). This is useful if you want to pipe to program
that wants to duplicate the screen layout of the screen.
```

## File: docs/pointer-shapes.rst
```rst
Mouse pointer shapes
=======================

.. versionadded:: 0.31.0

This is a simple escape code that can be used by terminal programs to change
the shape of the mouse pointer. This is useful for buttons/links, dragging to
resize panes, etc. It is based on the original escape code proposal from xterm
however, it properly specifies names for the different shapes in a system
independent manner, adds a stack for easy push/pop of shapes, allows programs
to query support and specifies interaction with other terminal state.

The escape code is of the form::

    <OSC> 22 ; <optional first char> <comma-separates list of shape names> <ESC>\

Here, ``<OSC>`` is the bytes ``<ESC>]`` and ``<ESC>`` is the byte ``0x1b``.
Spaces in the above are present for clarity only and should not be actually used.

First some examples::

    # Set the pointer to a pointing hand
    <OSC> 22 ; pointer <ESC>\
    # Reset the pointer to default
    <OSC> 22 ; <ESC>\
    # Push a shape onto the stack making it the current shape
    <OSC> 22 ; >wait <ESC>\
    # Pop a shape off the stack restoring to the previous shape
    <OSC> 22 ; < <ESC>\
    # Query the terminal for what the currently set shape is
    <OSC> 22 ; ?__current__ <ESC>\

To demo the various shapes, simply run the following command inside kitty::

    kitten mouse-demo

For more details see below.

Setting the pointer shape
-------------------------------

For set operations, the optional first char can be either ``=`` or omitted.
Follow the first char with the name of the shape. See the
:ref:`pointer_shape_names` table.


Pushing and popping shapes onto the stack
---------------------------------------------

The terminal emulator maintains a stack of shapes. To add shapes to the stack,
the optional first char must be ``>`` followed by a comma separated list of
shape names. See the :ref:`pointer_shape_names` table. All the specified names
are added to the stack, with the last name being the top of the stack and the
current shape. If the stack is full, the entry at the bottom of the stack is
evicted. Terminal implementations are free to choose an appropriate maximum
stack size, with a minimum stack size of 16.

To pop shapes of the top of the stack the optional first char must be ``<``.
The comma separated list of names is ignored. Once the stack is empty further
pops have no effect. An empty stack means the terminal is free to use whatever
pointer shape it likes.


Querying support
-------------------

Terminal programs can ask the terminal about this feature by setting the
optional first char to ``?``. The comma separated list of names is then
considered the query to which the terminal must respond with an OSC 22 code.
For example::

    <OSC> 22 ; ?__current__ <ESC>\
    results in
    <OSC> 22 ; shape_name <ESC>\

Here, ``shape_name`` will be a name from the table of shape names below or ``0``
if the stack is empty, i.e., no shape is currently set.

To check if the terminal supports some shapes, pass the shape names and the
terminal will reply with a comma separated list of zeros and ones where 1 means
the shape name is supported and zero means it is not. For example::

    <OSC> 22 ; ?pointer,crosshair,no-such-name,wait <ESC>\
    results in
    <OSC> 22 ; 1,1,0,1 <ESC>\

In addition to ``__current__`` there are a couple of other special names::

    __default__ - The terminal responds with the shape name of the shape used by default
    __grabbed__ - The terminal responds with the shape name of the shape used when the mouse is "grabbed"


Interaction with other terminal features
---------------------------------------------

The terminal must maintain separate shape stacks for the *main* and *alternate*
screens. This allows full screen programs, which are likely to be the main
consumers of this feature, to easily temporarily switch back from the alternate screen,
without needing to worry about pointer shape state. Think of suspending a
terminal editor to get back to the shell, for example.

Resetting the terminal must empty both the shape stacks.

When dragging to select text, the terminal is free to ignore any mouse pointer
shape specified using this escape code in favor of one appropriate for
dragging.  Similarly, when hovering over a URL or OSC 8 based hyperlink, the
terminal may choose to change the mouse pointer regardless of the value set by
this escape code.

This feature is independent of mouse reporting. The changed pointer shapes apply
regardless of whether the terminal program has enabled mouse reporting or not.


.. _pointer_shape_names:

Pointer shape names
----------------------------------

There is a well defined set of shape names that all conforming terminal
emulators must support. The list is based on the names used by the `cursor
property in the CSS standard
<https://developer.mozilla.org/en-US/docs/Web/CSS/cursor>`__, click the link to
see representative images for the names. Valid names must consist of only the
characters from the set ``a-z0-9_-``.

.. start list of shape css names (auto generated by gen-key-constants.py do not edit)

#. alias
#. cell
#. copy
#. crosshair
#. default
#. e-resize
#. ew-resize
#. grab
#. grabbing
#. help
#. move
#. n-resize
#. ne-resize
#. nesw-resize
#. no-drop
#. not-allowed
#. ns-resize
#. nw-resize
#. nwse-resize
#. pointer
#. progress
#. s-resize
#. se-resize
#. sw-resize
#. text
#. vertical-text
#. w-resize
#. wait
#. zoom-in
#. zoom-out

.. end list of shape css names

To demo the various shapes, simply run the following command inside kitty::

    kitten mouse-demo

Legacy xterm compatibility
----------------------------

The original xterm proposal for this escape code used shape names from the
:file:`X11/cursorfont.h` header on X11 based systems. Terminal implementations
wishing to maintain compatibility with xterm can also implement these names as
aliases for the CSS based names defined in the :ref:`pointer_shape_names` table.

The simplest mode of operation of this escape code, which is no leading
optional char and a single shape name is compatible with xterm.
```

## File: docs/press-mentions.rst
```rst
Press mentions of kitty
========================

`Python Bytes 272 <https://youtu.be/8HKliSbA-gQ?t=815>`__ (Feb 2022)
    A podcast demoing some of kitty's coolness

`Console #88 <https://console.substack.com/p/console-88>`__ (Jan 2022)
    An interview with Kovid about kitty


Video reviews
--------------

`Review (Jan 2021) <https://www.youtube.com/watch?v=TTzP2zYJn2k>`__
    A kitty review by distrotube

`Review (Dec 2020) <https://www.youtube.com/watch?v=KUMkLhFeBrI>`__
    A kitty review/intro by TechHut
```

## File: docs/protocol-extensions.rst
```rst
Terminal protocol extensions
===================================

|kitty| has extensions to the legacy terminal protocol, to enable advanced
features. These are typically in the form of new or re-purposed escape codes.
While these extensions are currently |kitty| specific, it would be nice to get
some of them adopted more broadly, to push the state of terminal emulators
forward.

The goal of these extensions is to be as small and unobtrusive as possible,
while filling in some gaps in the existing xterm protocol. In particular, one of
the goals of this specification is explicitly not to "re-imagine" the TTY. The
TTY should remain what it is -- a device for efficiently processing text
received as a simple byte stream. Another objective is to only move the minimum
possible amount of extra functionality into the terminal program itself. This is
to make it as easy to implement these protocol extensions as possible, thereby
hopefully encouraging their widespread adoption.

If you wish to discuss these extensions, propose additions or changes to them,
please do so by opening issues in the `GitHub bug tracker
<https://github.com/kovidgoyal/kitty/issues>`__.


.. toctree::
   :maxdepth: 1

   underlines
   graphics-protocol
   keyboard-protocol
   text-sizing-protocol
   multiple-cursors-protocol
   file-transfer-protocol
   desktop-notifications
   pointer-shapes
   unscroll
   color-stack
   deccara
   clipboard
   misc-protocol
```

## File: docs/quake-screenshots.rst
```rst
.. sidebar::

    .. only:: not man

        **Screenshots**

        .. figure:: /screenshots/quake-macos.webp
            :alt: Screenshot, showing the kitty floating quick access terminal above the background which is the program btop, running inside kitty, on macOS
            :align: center
            :width: 100%

            macOS


        .. figure:: /screenshots/quake-hypr.webp
            :alt: Screenshot, showing the kitty floating quick access terminal above the background which is the program btop, running inside kitty, on Hyprland in Linux
            :align: center
            :width: 100%

            Linux

        .. figure:: /screenshots/panel.png
            :alt: Screenshot, showing a sample panel
            :align: center
            :width: 100%

            A sample panel on Linux

        How the screenshots :ref:`were generated <quake_ss>`.
```

## File: docs/quickstart.rst
```rst
.. _quickstart:

Quickstart
===========

.. toctree::
   :hidden:

   binary
   build

Pre-built binaries of |kitty| are available for both macOS and Linux. See the
:doc:`binary install instructions </binary>`. You can also :doc:`build from
source </build>`.

Additionally, you can use your favorite package manager to install the |kitty|
package, but note that some Linux distribution packages are woefully outdated.
|kitty| is available in a vast number of package repositories for macOS
and Linux.

.. image:: https://repology.org/badge/tiny-repos/kitty-terminal.svg
   :target: https://repology.org/project/kitty-terminal/versions
   :alt: Number of repositories kitty is available in

See :doc:`Configuring kitty <conf>` for help on configuring |kitty| and
:doc:`Invocation <invocation>` for the command line arguments |kitty| supports.

For a tour of kitty's design and features, see the :doc:`overview`.
```

## File: docs/rc_protocol.rst
```rst
The kitty remote control protocol
==================================

The kitty remote control protocol is a simple protocol that involves sending
data to kitty in the form of JSON. Any individual command of kitty has the
form::

    <ESC>P@kitty-cmd<JSON object><ESC>\

Where ``<ESC>`` is the byte ``0x1b``. The JSON object has the form:

.. code-block:: json

    {
        "cmd": "command name",
        "version": "<kitty version>",
        "no_response": "<Optional Boolean>",
        "kitty_window_id": "<Optional value of the KITTY_WINDOW_ID env var>",
        "payload": "<Optional JSON object>"
    }

The ``version`` above is an array of the form :code:`[0, 14, 2]`. If you are
developing a standalone client, use the kitty version that you are developing
against. Using a version greater than the version of the kitty instance you are
talking to, will cause a failure.

Set ``no_response`` to ``true`` if you don't want a response from kitty.

The optional payload is a JSON object that is specific to the actual command
being sent. The fields in the object for every command are documented below.

As a quick example showing how easy to use this protocol is, we will implement
the ``@ ls`` command from the shell using only shell tools.

First, run kitty as::

    kitty -o allow_remote_control=socket-only --listen-on unix:/tmp/test

Now, in a different terminal, you can get the pretty printed ``@ ls`` output
with the following command line::

    echo -en '\eP@kitty-cmd{"cmd":"ls","version":[0,14,2]}\e\\' | socat - unix:/tmp/test | awk '{ print substr($0, 13, length($0) - 14) }' | jq -c '.data | fromjson' | jq .

There is also the statically compiled stand-alone executable ``kitten``
that can be used for this, available from the `kitty releases
<https://github.com/kovidgoyal/kitty/releases>`__ page::

    kitten @ --help

.. _rc_crypto:

Encrypted communication
--------------------------

.. versionadded:: 0.26.0

When using the :opt:`remote_control_password` option communication to the
terminal is encrypted to keep the password secure. A public key is used from
the :envvar:`KITTY_PUBLIC_KEY` environment variable. Currently, only one
encryption protocol is supported. The protocol number is present in
:envvar:`KITTY_PUBLIC_KEY` as ``1``. The key data in this environment variable
is :rfc:`Base-85 <1924>` encoded.  The algorithm used is `Elliptic Curve Diffie
Helman <https://en.wikipedia.org/wiki/Elliptic-curve_Diffie–Hellman>`__ with
the `X25519 curve <https://en.wikipedia.org/wiki/Curve25519>`__. A time based
nonce is used to minimise replay attacks. The original JSON command has the
fields: ``password`` and ``timestamp`` added. The timestamp is the number of
nanoseconds since the epoch, excluding leap seconds. Commands with a timestamp
more than 5 minutes from the current time are rejected. The command is then
encrypted using AES-256-GCM in authenticated encryption mode, with a symmetric
key that is derived from the ECDH key-pair by running the shared secret through
SHA-256 hashing, once.  An IV of at least 96 bits of CSPRNG data is used. The
tag for authenticated encryption **must** be at least 128 bits long.  The tag
**must** authenticate only the value of the ``encrypted`` field. A new command
is created and transmitted that contains the fields:

.. code-block:: json

    {
        "version": "<kitty version>",
        "iv": "base85 encoded IV",
        "tag": "base85 encoded AEAD tag",
        "pubkey": "base85 encoded ECDH public key of sender",
        "encrypted": "The original command encrypted and base85 encoded"
    }

Async and streaming requests
---------------------------------

Some remote control commands require asynchronous communication, that is, the
response from the terminal can happen after an arbitrary amount of time. For
example, the :code:`select-window` command requires the user to select a window
before a response can be sent. Such command must set the field :code:`async`
in the JSON block above to a random string that serves as a unique id. The
client can cancel an async request in flight by adding the :code:`cancel_async`
field to the JSON block. A async response remains in flight until the terminal
sends a response to the request. Note that cancellation requests dont need to
be encrypted as users must not be prompted for these and the worst a malicious
cancellation request can do is prevent another sync request from getting a
response.

Similar to async requests are *streaming* requests. In these the client has to
send a large amount of data to the terminal and so the request is split into
chunks. In every chunk the JSON block must contain the field ``stream`` set to
``true`` and ``stream_id`` set to a random long string, that should be the same for
all chunks in a request. End of data is indicated by sending a chunk with no data.

.. include:: generated/rc.rst
```

## File: docs/remote-control.rst
```rst
Control kitty from scripts
----------------------------

.. highlight:: sh

|kitty| can be controlled from scripts or the shell prompt. You can open new
windows, send arbitrary text input to any window, change the title of windows
and tabs, etc.

Let's walk through a few examples of controlling |kitty|.


Tutorial
------------

Start by running |kitty| as::

    kitty -o allow_remote_control=yes -o enabled_layouts=tall

In order for control to work, :opt:`allow_remote_control` or
:opt:`remote_control_password` must be enabled in :file:`kitty.conf`. Here we
turn it on explicitly at the command line.

Now, in the new |kitty| window, enter the command::

    kitten @ launch --title Output --keep-focus cat

This will open a new window, running the :program:`cat` program that will appear
next to the current window.

Let's send some text to this new window::

    kitten @ send-text --match cmdline:cat Hello, World

This will make ``Hello, World`` show up in the window running the :program:`cat`
program. The :option:`kitten @ send-text --match` option is very powerful, it
allows selecting windows by their titles, the command line of the program
running in the window, the working directory of the program running in the
window, etc. See :ref:`kitten @ send-text --help <at-send-text>` for details.

More usefully, you can pipe the output of a command running in one window to
another window, for example::

    ls | kitten @ send-text --match 'title:^Output' --stdin

This will show the output of :program:`ls` in the output window instead of the
current window. You can use this technique to, for example, show the output of
running :program:`make` in your editor in a different window. The possibilities
are endless.

You can even have things you type show up in a different window. Run::

    kitten @ send-text --match 'title:^Output' --stdin

And type some text, it will show up in the output window, instead of the current
window. Type :kbd:`Ctrl+D` when you are ready to stop.

Now, let's open a new tab::

   kitten @ launch --type=tab --tab-title "My Tab" --keep-focus bash

This will open a new tab running the bash shell with the title "My Tab".
We can change the title of the tab to "New Title" with::

   kitten @ set-tab-title --match 'title:^My' New Title

Let's change the title of the current tab::

   kitten @ set-tab-title Master Tab

Now lets switch to the newly opened tab::

   kitten @ focus-tab --match 'title:^New'

Similarly, to focus the previously opened output window (which will also switch
back to the old tab, automatically)::

   kitten @ focus-window --match 'title:^Output'

You can get a listing of available tabs and windows, by running::

   kitten @ ls

This outputs a tree of data in JSON format. The top level of the tree is all
:term:`OS windows <os_window>`. Each OS window has an id and a list of
:term:`tabs <tab>`. Each tab has its own id, a title and a list of :term:`kitty
windows <window>`. Each window has an id, title, current working directory,
process id (PID) and command-line of the process running in the window. You can
use this information with :option:`kitten @ focus-window --match` to control
individual windows.

As you can see, it is very easy to control |kitty| using the ``kitten @``
messaging system. This tutorial touches only the surface of what is possible.
See ``kitten @ --help`` for more details.

In the example's above, ``kitten @`` messaging works only when run
inside a |kitty| window, not anywhere. But, within a |kitty| window it even
works over SSH. If you want to control |kitty| from programs/scripts not running
inside a |kitty| window, see the section on :ref:`using a socket for remote control <rc_via_socket>`
below.

Note that if all you want to do is run a single |kitty| "daemon" and have
subsequent |kitty| invocations appear as new top-level windows, you can use the
simpler :option:`kitty --single-instance` option, see ``kitty --help`` for that.


.. _rc_via_socket:

Remote control via a socket
--------------------------------
To control kitty from outside kitty, it is necessary to setup a socket to
communicate with kitty. First, start |kitty| as::

    kitty -o allow_remote_control=yes --listen-on unix:/tmp/mykitty

The :option:`kitty --listen-on` option tells |kitty| to listen for control
messages at the specified UNIX-domain socket. See ``kitty --help`` for details.
Now you can control this instance of |kitty| using the :option:`kitten @ --to`
command line argument to ``kitten @``. For example::

    kitten @ --to unix:/tmp/mykitty ls


The builtin kitty shell
--------------------------

You can explore the |kitty| command language more easily using the builtin
|kitty| shell. Run ``kitten @`` with no arguments and you will be dropped into
the |kitty| shell with completion for |kitty| command names and options.

You can even open the |kitty| shell inside a running |kitty| using a simple
keyboard shortcut (:sc:`kitty_shell` by default).

.. note:: Using the keyboard shortcut has the added advantage that you don't need to use
   :opt:`allow_remote_control` to make it work.


Allowing only some windows to control kitty
----------------------------------------------

If you do not want to allow all programs running in |kitty| to control it, you
can selectively enable remote control for only some |kitty| windows. Simply
create a shortcut such as::

    map ctrl+k launch --allow-remote-control some_program

Then programs running in windows created with that shortcut can use ``kitten @``
to control kitty. Note that any program with the right level of permissions can
still write to the pipes of any other program on the same computer and therefore
can control |kitty|. It can, however, be useful to block programs running on
other computers (for example, over SSH) or as other users.

.. note:: You don't need :opt:`allow_remote_control` to make this work as it is
   limited to only programs running in that specific window. Be careful with
   what programs you run in such windows, since they can effectively control
   kitty, as if you were running with :opt:`allow_remote_control` turned on.

    You can further restrict what is allowed in these windows by using
    :option:`kitten @ launch --remote-control-password`.


Fine grained permissions for remote control
----------------------------------------------

.. versionadded:: 0.26.0

The :opt:`allow_remote_control` option discussed so far is a blunt
instrument, granting the ability to any program running on your computer
or even on remote computers via SSH the ability to use remote control.

You can instead define remote control passwords that can be used to grant
different levels of control to different places. You can even write your
own script to decide which remote control requests are allowed. This is
done using the :opt:`remote_control_password` option in :file:`kitty.conf`.
Set :opt:`allow_remote_control` to :code:`password` to use this feature.
Let's see some examples:

.. code-block:: conf

   remote_control_password "control colors" get-colors set-colors

Now, using this password, you can, in scripts run the command::

    kitten @ --password="control colors" set-colors background=red

Any script with access to the password can now change colors in kitty using
remote control, but only that and nothing else. You can even supply the
password via the :envvar:`KITTY_RC_PASSWORD` environment variable, or the
file :file:`~/.config/kitty/rc-pass` to avoid having to type it repeatedly.
See :option:`kitten @ --password-file` and :option:`kitten @ --password-env`.

The :opt:`remote_control_password` can be specified multiple times to create
different passwords with different capabilities. Run the following to get a
list of all action names::

    kitten @ --help

You can even use glob patterns to match action names, for example:

.. code-block:: conf

   remote_control_password "control colors" *-colors

If no action names are specified, all actions are allowed.

If ``kitten @`` is run with a password that is not present in
:file:`kitty.conf`, then kitty will interactively prompt the user to allow or
disallow the remote control request. The user can choose to allow or disallow
either just that request or all requests using that password. The user's
decision is remembered for the duration of that kitty instance.

.. note::
   For password based authentication to work over SSH, you must pass the
   :envvar:`KITTY_PUBLIC_KEY` environment variable to the remote host. The
   :doc:`ssh kitten <kittens/ssh>` does this for you automatically. When
   using a password, :ref:`rc_crypto` is used to ensure the password
   is kept secure. This does mean that using password based authentication
   is slower as the entire command is encrypted before transmission. This
   can be noticeable when using a command like ``kitten @ set-background-image``
   which transmits large amounts of image data. Also, the clock on the remote
   system must match (within a few minutes) the clock on the local system.
   kitty uses a time based nonce to minimise the potential for replay attacks.

.. _rc_custom_auth:

Customizing authorization with your own program
____________________________________________________________

If the ability to control access by action names is not fine grained enough,
you can define your own Python script to examine every remote control command
and allow/disallow it. To do so create a file in the kitty configuration
directory, :file:`~/.config/kitty/my_rc_auth.py` and add the following
to :file:`kitty.conf`:

.. code-block:: conf

    remote_control_password "testing custom auth" my_rc_auth.py

:file:`my_rc_auth.py` should define a :code:`is_cmd_allowed` function
as shown below:

.. code-block:: py

    def is_cmd_allowed(pcmd, window, from_socket, extra_data):
        cmd_name = pcmd['cmd']  # the name of the command
        cmd_payload = pcmd['payload']  # the arguments to the command
        # examine the cmd_name and cmd_payload and return True to allow
        # the command or False to disallow it. Return None to have no
        # effect on the command.

        # The command payload will vary from command to command, see
        # the rc protocol docs for details. Below is an example of
        # restricting the launch command to allow only running the
        # default shell.

        if cmd_name != 'launch':
            return None
        if cmd_payload.get('args') or cmd_payload.get('env') or cmd_payload.get('copy_cmdline') or cmd_payload.get('copy_env'):
            return False
        # prints in this function go to the parent kitty process STDOUT
        print('Allowing launch command:', cmd_payload)
        return True


.. note::

    The payloads for the different remote control commands are documented in the
    :doc:`remote control protocol specification <rc_protocol>`.


.. _rc_mapping:

Mapping key presses to remote control commands
--------------------------------------------------

If you wish to trigger a remote control command easily with just a keypress,
you can map it in :file:`kitty.conf`. For example::

    map f1 remote_control set-spacing margin=30

Then pressing the :kbd:`F1` key will set the active window margins to
:code:`30`. The syntax for what follows :ac:`remote_control` is exactly the same
as the syntax for what follows :code:`kitten @` above.

If you wish to ignore errors from the command, prefix the command with an
``!``. For example, the following will not return an error when no windows
are matched::

    map f1 remote_control !focus-window --match XXXXXX

If you wish to run a more complex script, you can use::

    map f1 remote_control_script /path/to/myscript

In this script you can use ``kitten @`` to run as many remote
control commands as you like and process their output.
:ac:`remote_control_script` is similar to the
:ac:`launch` command with ``--type=background --allow-remote-control``.
For more advanced usage, including fine grained permissions, setting
env vars, command line interpolation, passing data to STDIN, etc.
the :doc:`launch <launch>` command should be used.

.. note:: You do not need :opt:`allow_remote_control` to use these mappings,
   as they are not actual remote programs, but are simply a way to reuse the
   remote control infrastructure via keybings.


Broadcasting what you type to all kitty windows
--------------------------------------------------

As a simple illustration of the power of remote control, lets
have what we type sent to all open kitty windows. To do that define the
following mapping in :file:`kitty.conf`::

    map f1 launch --allow-remote-control kitty +kitten broadcast

Now press :kbd:`F1` and start typing, what you type will be sent to all windows,
live, as you type it.


The remote control protocol
-----------------------------------------------

If you wish to develop your own client to talk to |kitty|, you can use the
:doc:`remote control protocol specification <rc_protocol>`. Note that there
is a statically compiled, standalone executable, ``kitten`` available that
can be used as a remote control client on any UNIX like computer. This can be
downloaded and used directly from the `kitty releases
<https://github.com/kovidgoyal/kitty/releases>`__ page::

    kitten @ --help


.. _search_syntax:

Matching windows and tabs
----------------------------

Many remote control operations operate on windows or tabs. To select these, the
:code:`--match` option is often used. This allows matching using various
sophisticated criteria such as title, ids, command lines, etc. These criteria are
expressions of the form :code:`field:query`. Where :italic:`field` is the field
against which to match and :italic:`query` is the expression to match. They can
be further combined using Boolean operators, best illustrated with some
examples::

    title:"My special window" or id:43
    title:bash and env:USER=kovid
    not id:1
    (id:2 or id:3) and title:something

.. include:: generated/matching.rst

.. toctree::
   :hidden:

   rc_protocol

.. include:: generated/cli-kitten-at.rst
```

## File: docs/sessions.rst
```rst
.. _sessions:

Sessions
=============

kitty has robust support for sessions. A session is basically a simple text
file where you can define kitty windows, tabs and what programs to run in them
as well as how to layout the windows. kitty also supports actions to easily
:ac:`create and switch between existing sessions <goto_session>`, so that you
can move seamlessly from working on one project to another with a couple of keystrokes.

Let's see a quick example to get a feel of how easy it is to create sessions. First,
a session file to develop a project:

.. code-block:: session

    # Set the layout for the current tab
    layout tall
    # Set the working directory for windows in the current tab
    cd ~/path/to/myproject
    # Create the "main" window and run an editor in it to edit the project files
    launch --title "Edit My Project" /usr/bin/nvim
    # Create a side window to run a shell to build or test project
    launch --title "Build My Project"
    # Create another side window to keep an eye on some useful log file
    launch --title "Log for my project" /usr/bin/tail -f /path/to/project/log/file

Save this file as :file:`~/path/to/myproject/launch.kitty-session`. Now when
you want to work on the project, simply run:

.. code-block:: sh

    kitty --session ~/path/to/myproject/launch.kitty-session

You can also set the session in :file:`kitty.conf` via :opt:`startup_session`.

Thus, it is very easy to create sessions and work on projects. To learn how to
create more complex sessions, see :ref:`complex_sessions`.


.. _goto_session:

Creating/Switching to sessions with a keypress
------------------------------------------------

If you like to manage multiple sessions within a single terminal and
easily swap between them, kitty has you covered. You can use the
:ac:`goto_session` action in kitty.conf, like this:

.. code-block:: conf

   # Press F7 and then c to jump to the "cool" project
   map f7>c goto_session ~/path/to/cool/cool.kitty-session
   # Press F7 and then h to jump to the "hot" project
   map f7>h goto_session ~/path/to/hot/hot.kitty-session
   # Browse and select from the list of known projects defined via goto_session commands
   map f7>/ goto_session
   # Same as above, but the sessions are listed alphabetically instead of by most recent
   map f7>/ goto_session --sort-by=alphabetical
   # Browse session files inside a directory and pick one
   map f7>p goto_session ~/.local/share/kitty/sessions
   # Go to the previously active session (larger negative numbers jump further back in history)
   map f7>- goto_session -1

In this manner you can define as many projects/sessions as you like and easily
switch between them with a keypress.

When a directory path is supplied to :ac:`goto_session`, kitty scans it for
files ending in ``.kitty-session``, ``.kitty_session`` or ``.session`` and
presents an interactive list. The ``--sort-by`` option controls the ordering of that list just like it does
for globally known sessions.

You can also close sessions using the :ac:`close_session` action, which closes
all windows in the session with a single keypress.


Displaying the currently active session name
----------------------------------------------

You can display the name of the currently active session file in the kitty tab
bar using :opt:`tab_title_template`. For example, using the value::

    {session_name} {title}

will show you the name of the session file the current tab was loaded from, as
well as the normal tab title. Or alternatively, you can set the tab title
directly to a project name in the session file itself when creating the tab,
like this::

    new_tab My Project Name

.. _complex_sessions:

More complex sessions
-------------------------

If you want to create more complex sessions, with sophisticated layouts, such
as :ref:`splits_layout`, the easiest way is to set up the state you want to
save manually by first starting kitty like this:

.. code-block:: sh

    kitty -o 'map f1 save_as_session --use-foreground-process --relocatable'

Now create whatever splits and tabs you need and start whatever programs such
as editors, REPLs, debuggers, etc. you want to start in each of them. Once
kitty is the way you want it, press the :kbd:`F1` key, and you will be prompted
for a path at which to save the session file. Specify the path and the session
will be saved there with the exact setup you created. The saved file will even
be opened in your editor for you to review, automatically.

.. tip::
   If you want session files to be saved to a specific directory regardless of
   your current working directory, use the ``--base-dir`` option. For example::

       map f7>s save_as_session --use-foreground-process --base-dir ~/.local/share/kitty/sessions

   This is particularly useful when kitty is launched from system-wide shortcuts
   where the working directory might not be your home directory. Note that
   ``--relocatable`` is typically not used with ``--base-dir``, since relocatable
   is meant for session files that are co-located with their project directories.

If instead, you want to create these by hand, see the example below which shows
all the major keywords you can use in kitty session files:

.. code-block:: session

    # Set the layout for the current tab
    layout tall
    # Set the working directory for windows in the current tab. Relative paths
    # are resolved with respect to the location of this session file.
    cd ~
    # Create a window and run the specified command in it
    launch zsh
    # Create a window with some environment variables set and run vim in it
    launch --env FOO=BAR vim
    # Set the title for the next window
    launch --title "Chat with x" irssi --profile x
    # Run a short lived command and see its output
    launch --hold message-of-the-day

    # Create a new tab
    # The part after new_tab is the optional tab title which will be displayed in
    # the tab bar, if omitted, the title of the active window will be used instead.
    new_tab my tab
    cd somewhere
    # Set the layouts allowed in this tab
    enabled_layouts tall,stack
    # Set the current layout
    layout stack
    launch zsh

    # Create a new OS window
    # Any definitions specified before the first new_os_window will apply to first OS window.
    new_os_window
    # Set new window size to 80x24 cells
    os_window_size 80c 24c
    # Set the --title for the new OS window
    os_window_title my fancy os window
    # Set the --class for the new OS window
    os_window_class mywindow
    # Set the --name for the new OS window
    os_window_name myname
    # Change the OS window state to normal, fullscreen, maximized or minimized
    os_window_state normal
    launch sh
    # Resize the current window (see the resize_window action for details)
    resize_window wider 2
    # Make the current window the active (focused) window in its tab
    focus
    # Make the current OS Window the globally active window
    focus_os_window
    launch emacs

    # Create another tab
    new_tab logs
    launch tail -f /var/log/syslog

    # Focus the first tab (index 0) when the session loads
    # You can also use a match expression like: focus_tab title:logs
    focus_tab 0

    # Create a complex layout using multiple splits. Creates two columns of
    # windows with two windows in each column. The windows in the first column are
    # split 50:50. In the second column the windows are not evenly split.
    new_tab complex tab
    layout splits
    # First window, set a user variable on it so we can focus it later
    launch --var window=first
    # Create the second column by splitting the first window vertically
    launch --location=vsplit
    # Create the third window in the second column by splitting the second window horizontally
    # Make it take 40% of the height instead of 50%
    launch --location=hsplit --bias=40
    # Go back to focusing the first window, so that we can split it
    focus_matching_window var:window=first
    # Create the final window in the first column
    launch --location=hsplit


.. note::
    The :doc:`launch <launch>` command when used in a session file cannot create
    new OS windows, or tabs.

.. note::
    Environment variables of the form :code:`${NAME}` or :code:`$NAME` are
    expanded in the session file, except in the *arguments* (not options) to the
    launch command. For example:

    .. code-block:: sh

        launch --cwd=$THIS_IS_EXPANDED some-program $THIS_IS_NOT_EXPANDED


Making newly created windows join an existing session
---------------------------------------------------------

Normally, after activating a session, if you create new windows/tabs
they don't belong to the session. If you would prefer to have them belong
to the currently active session, you can use the :ac:`new_window_with_cwd`
and :ac:`new_tab_with_cwd` actions instead, like this::

    map kitty_mod+enter new_window_with_cwd
    map kitty_mod+t new_tab_with_cwd
    map kitty_mod+n new_os_window_with_cwd

This will cause newly created windows and tabs to belong to the currently active
session, if any. Note that adding a window to a session in this way is
temporary, it does not edit the session file. If you wish to update the
session file of the currently active session, you can use the following
mapping for it::

    map f5 save_as_session --relocatable --use-foreground-process --match=session:. .

The two can be combined, using the :ac:`combine` action.
For even more control of what session a window is added to use
the :doc:`launch <launch>` command with the :option:`launch --add-to-session`
flag.


Sessions with remote connections
-------------------------------------

If you use the :doc:`ssh kitten </kittens/ssh>` to connect to remote computers,
:ac:`save_as_session` is smart enough to save the ssh kitten invocation to your
session file, preserving the remote working directory and even the currently
running program on the remote host! Try it, run kitty with::

    kitty -o 'map f1 save_as_session --use-foreground-process --relocatable' --session <(echo "layout vertical\nlaunch\nlaunch")

Now in both windows, run::

    kitten ssh localhost

To connect them both to a remote computer (replace ``localhost`` with another
computer if you like). In one window change the directory to /tmp and in the
other start some program. Then press :kbd:`F1` to save the session file.
When you run the session file in another kitty instance you will see both
windows re-created, as expected with the correct working directories and
running programs.

Managing multi tab sessions in a single OS Window
----------------------------------------------------

The natural way to organise sessions in kitty is one per :term:`os_window`.
However, if you prefer to manage multiple sessions in a single OS Window, you
can configure the kitty tab bar to only show tabs that belong to the currently
active session. To do so, use :opt:`tab_bar_filter` in :file:`kitty.conf` set::

    tab_bar_filter session:~ or session:^$

This will restrict the tab bar to only showing tabs from the currently active
session as well tabs that do not belong to any session. Furthermore, when you
are in a window or tab that does not belong to any session, the tab bar will
show the tabs from the most recent active session, to maintain context.

Keyword reference
---------------------

Below is the list of all supported keywords in session files along with
documentation for them.

``cd [path]``
    Change the working directory for all windows in the current tab to
    ``path``. Relative paths are resolved with respect to the directory
    containing the session file.

``focus``
    Give keyboard focus to the window created by the previous launch command

``focus_matching_window``
    Give keyboard focus to window that matches the specified expression. See
    :ref:`search_syntax` for the syntax for matching expressions.

``focus_os_window``
    Give keyboard focus to the current OS Window. This is guaranteed to work
    only is some other OS Window in the current kitty process has focus,
    otherwise the window manager might block changing focus to prevent *focus
    stealing*.

``focus_tab [tab specifier]``
    Set which tab should be active (focused) in the current OS Window. The tab
    specifier can be either a plain number (treated as a 0-based index) or a
    match expression. For example, ``focus_tab 0`` will focus the first tab,
    ``focus_tab 1`` the second tab, and ``focus_tab title:logs`` will focus the
    tab whose title matches "logs". See :ref:`search_syntax` for the full syntax
    of match expressions. This is useful for session files that create multiple
    tabs and want to ensure a specific tab is active when the session is loaded.

``enabled_layouts comma separated list of layout names``
    Set the layouts allowed in the current tab. Same syntax as
    :opt:`enabled_layouts`.

``launch``
    Create a new window running the specified command or the default shell if
    no command is specified. See :doc:`launch` for details. Note that creating
    tabs and OS Windows using launch is not supported in session files, use the
    dedicated keywords for these.

``layout name``
    Set the layout for the current tab to the specified layout, including any
    specified options, see :doc:`layouts` for the available layouts and
    options.

``new_os_window``
    Create a new OS Window. Any OS window related keywords specified before the
    first ``new_os_window`` will apply to the first OS Window.

``new_tab [tab title]``
    Create a new tab with the specified title. If no title is specified, the
    title behaves just as for a regular tab in kitty.

``os_window_title``
    Set the title for the current OS Window. The OS Window will then always
    have this title, it will not change based on the title of the currently active
    window inside the OS Window.

``os_window_class``
    Set the class part of WM_CLASS or Wayland Application Id for the current OS Window

``os_window_name``
    Set the name part of WM_CLASS or Wayland Window tag for the current OS Window

``os_window_size``
    Set the size of the current OS Window, can be specified in pixels or cells.
    For example: 80c 24c is a window of width 80 cells by 24 cells.

``os_window_state``
    Set the state of the current OS Window, can be: ``normal``, ``fullscreen``, ``maximized`` or ``minimized``

``resize_window``
    Resize the current window. See the :ac:`resize_window` action for details.
    For example: resize_window wider 2

``set_layout_state``
    This keyword is only used in session files generated by the
    :ac:`save_as_session` action, it's syntax is undocumented and for internal
    use only.

``title``
    Set the title for the next window. Deprecated, use ``launch --title``
    instead.


.. _save_as_session:

The save_as_session action
------------------------------

This action can be mapped to a key press in :file:`kitty.conf`. It will save
the currently open OS Windows, tabs, windows, running programs, working
directories, etc. into a session file. It is a convenient way to
:ref:`complex_sessions`. The options this action takes are documented below.

.. include:: generated/save-as-session.rst
```

## File: docs/shell-integration.rst
```rst
.. _shell_integration:

Shell integration
-------------------

kitty has the ability to integrate closely within common shells, such as `zsh
<https://www.zsh.org/>`__, `fish <https://fishshell.com>`__ and `bash
<https://www.gnu.org/software/bash/>`__ to enable features such as jumping to
previous prompts in the scrollback, viewing the output of the last command in
:program:`less`, using the mouse to move the cursor while editing prompts, etc.

.. versionadded:: 0.24.0

Features
-------------

* Open the output of the last command in a pager such as :program:`less`
  (:sc:`show_last_command_output`)

* Jump to the previous/next prompt in the scrollback
  (:sc:`scroll_to_previous_prompt` /  :sc:`scroll_to_next_prompt`)

* Click with the mouse anywhere in the current command to move the cursor there

* Hold :kbd:`Ctrl+Shift` and right-click on any command output in the scrollback
  to view it in a pager

* The current working directory or the command being executed are automatically
  displayed in the kitty window titlebar/tab title

* The text cursor is changed to a bar when editing commands at the shell prompt

* :ref:`clone_shell` with all environment variables and the working directory
  copied

* :ref:`Edit files in new kitty windows <edit_file>` even over SSH

* Glitch free window resizing even with complex prompts. Achieved by erasing
  the prompt on resize and allowing the shell to redraw it cleanly.

* Sophisticated completion for the :program:`kitty` command in the shell.

* When confirming a quit command if a window is sitting at a shell prompt,
  it is not counted (for details, see :opt:`confirm_os_window_close`)


Configuration
---------------

Shell integration is controlled by the :opt:`shell_integration` option. By
default, all integration features are enabled. Individual features can be turned
off or it can be disabled entirely as well. The :opt:`shell_integration` option
takes a space separated list of keywords:

disabled
    Turn off all shell integration. The shell's launch environment is not
    modified and :envvar:`KITTY_SHELL_INTEGRATION` is not set. Useful for
    :ref:`manual integration <manual_shell_integration>`.

no-rc
    Do not modify the shell's launch environment to enable integration. Useful
    if you prefer to load the kitty shell integration code yourself, either as
    part of :ref:`manual integration <manual_shell_integration>` or because
    you have some other software that sets up shell integration.
    This will still set the :envvar:`KITTY_SHELL_INTEGRATION` environment
    variable when kitty runs the shell.

no-cursor
    Turn off changing of the text cursor to a bar when editing shell command
    line.

no-title
    Turn off setting the kitty window/tab title based on shell state.
    Note that for the fish shell kitty relies on fish's native title setting
    functionality instead.

no-cwd
    Turn off reporting the current working directory. This is used to allow
    :ac:`new_window_with_cwd` and similar to open windows logged into remote
    machines using the :doc:`ssh kitten <kittens/ssh>` automatically with the
    same working directory as the current window.
    Note that for the fish shell this will not disable its built-in current
    working directory reporting.

no-prompt-mark
    Turn off marking of prompts. This disables jumping to prompt, browsing
    output of last command and click to move cursor functionality.
    Note that for the fish shell this does not take effect, since fish always
    marks prompts.

no-complete
    Turn off completion for the kitty command.
    Note that for the fish shell this does not take effect, since fish already
    comes with a kitty completion script.

no-sudo
    Do not alias :program:`sudo` to ensure the kitty terminfo files are
    available in the sudo environment. This is needed if you have sudo
    configured to disable setting of environment variables on the command line.
    By default, if sudo is configured to allow all commands for the current
    user, setting of environment variables at the command line is also allowed.
    Only if commands are restricted is this needed.


More ways to browse command output
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

You can add further key and mouse bindings to browse the output of commands
easily. For example to select the output of a command by right clicking the
mouse on the output, define the following in :file:`kitty.conf`:

.. code:: conf

    mouse_map right press ungrabbed mouse_select_command_output

Now, when you right click on the output, the entire output is selected, ready
to be copied.

The feature to jump to previous prompts (
:sc:`scroll_to_previous_prompt` and :sc:`scroll_to_next_prompt`) and mouse
actions (:ac:`mouse_select_command_output` and :ac:`mouse_show_command_output`)
can be integrated with browsing command output as well. For example, define the
following mapping in :file:`kitty.conf`:

.. code:: conf

    map f1 show_last_visited_command_output

Now, pressing :kbd:`F1` will cause the output of the last jumped to command or
the last mouse clicked command output to be opened in a pager for easy browsing.

In addition, You can define shortcut to get the first command output on screen.
For example, define the following in :file:`kitty.conf`:

.. code:: conf

    map f1 show_first_command_output_on_screen

Now, pressing :kbd:`F1` will cause the output of the first command output on
screen to be opened in a pager.

You can also add shortcut to scroll to the last jumped position. For example,
define the following in :file:`kitty.conf`:

.. code:: conf

    map f1 scroll_to_prompt 0


How it works
-----------------

At startup, kitty detects if the shell you have configured (either system wide
or the :opt:`shell` option in :file:`kitty.conf`) is a supported shell. If so,
kitty injects some shell specific code into the shell, to enable shell
integration. How it does so varies for different shells.


.. tab:: zsh

   For zsh, kitty sets the :envvar:`ZDOTDIR` environment variable to make zsh
   load kitty's :file:`.zshenv` which restores the original value of
   :envvar:`ZDOTDIR` and sources the original :file:`.zshenv`. It then loads
   the shell integration code. The remainder of zsh's startup process proceeds
   as normal.

.. tab:: fish

    For fish, to make it automatically load the integration code provided by
    kitty, the integration script directory path is prepended to the
    :envvar:`XDG_DATA_DIRS` environment variable. This is only applied to the
    fish process and will be cleaned up by the integration script after startup.
    No files are added or modified.

.. tab:: bash

    For bash, kitty starts bash in POSIX mode, using the environment variable
    :envvar:`ENV` to load the shell integration script. This prevents bash from
    loading any startup files itself. The loading of the startup files is done
    by the integration script, after disabling POSIX mode. From the perspective
    of those scripts there should be no difference to running vanilla bash.


Then, when launching the shell, kitty sets the environment variable
:envvar:`KITTY_SHELL_INTEGRATION` to the value of the :opt:`shell_integration`
option. The shell integration code reads the environment variable, turns on the
specified integration functionality and then unsets the variable so as to not
pollute the system.

The actual shell integration code uses hooks provided by each shell to send
special escape codes to kitty, to perform the various tasks. You can see the
code used for each shell below:

.. raw:: html

    <details>
    <summary>Click to toggle shell integration code</summary>

.. tab:: zsh

    .. literalinclude:: ../shell-integration/zsh/kitty-integration
        :language: zsh


.. tab:: fish

    .. literalinclude:: ../shell-integration/fish/vendor_conf.d/kitty-shell-integration.fish
        :language: fish
        :force:

.. tab:: bash

    .. literalinclude:: ../shell-integration/bash/kitty.bash
        :language: bash

.. raw:: html

   </details>


Shell integration over SSH
----------------------------

The easiest way to have shell integration work when SSHing into remote systems
is to use the :doc:`ssh kitten <kittens/ssh>`. Simply run::

    kitten ssh hostname

And, by magic, you will be logged into the remote system with fully functional
shell integration. Alternately, you can :ref:`setup shell integration manually
<manual_shell_integration>`, by copying the kitty shell integration scripts to
the remote server and editing the shell rc files there, as described below.


Shell integration in a container
----------------------------------

Install the kitten `standalone binary
<https://github.com/kovidgoyal/kitty/releases/latest/download/kitten-linux-amd64>`__ in the container
somewhere in the PATH, then you can log into the container with:

.. code-block:: sh

   docker exec -ti container-id kitten run-shell --shell=/path/to/your/shell/in/the/container

The kitten will even take care of making the kitty terminfo database available
in the container automatically.

.. _clone_shell:

Clone the current shell into a new window
-----------------------------------------------

You can clone the current shell into a new kitty window by simply running the
:command:`clone-in-kitty` command, for example:

.. code-block:: sh

    clone-in-kitty
    clone-in-kitty --type=tab
    clone-in-kitty --title "I am a clone"

This will open a new window running a new shell instance but with all
environment variables and the current working directory copied. This even works
over SSH when using :doc:`kittens/ssh`.

The :command:`clone-in-kitty` command takes almost all the same arguments as the
:doc:`launch <launch>` command, so you can open a new tab instead or a new OS
window, etc. Arguments of launch that can cause code execution or that don't
make sense when cloning are ignored. Most prominently, the following options are
ignored: :option:`--allow-remote-control <launch --allow-remote-control>`,
:option:`--copy-cmdline <launch --copy-cmdline>`, :option:`--copy-env <launch
--copy-env>`, :option:`--stdin-source <launch --stdin-source>`,
:option:`--marker <launch --marker>` and :option:`--watcher <launch --watcher>`.

:command:`clone-in-kitty` can be configured to source arbitrary code in the
cloned window using environment variables. It will automatically clone virtual
environments created by the :link:`Python venv module
<https://docs.python.org/3/library/venv.html>` or :link:`Conda
<https://conda.io/>`. In addition, setting the
env var :envvar:`KITTY_CLONE_SOURCE_CODE` to some shell code will cause that
code to be run in the cloned window with :code:`eval`. Similarly, setting
:envvar:`KITTY_CLONE_SOURCE_PATH` to the path of a file will cause that file to
be sourced in the cloned window. This can be controlled by
:opt:`clone_source_strategies`.

:command:`clone-in-kitty` works by asking the shell to serialize its internal
state (mainly CWD and env vars) and this state is transmitted to kitty and
restored by the shell integration scripts in the cloned window.


.. _edit_file:

Edit files in new kitty windows even over SSH
------------------------------------------------

.. code-block:: sh

   edit-in-kitty myfile.txt
   edit-in-kitty --type tab --title "Editing My File" myfile.txt
   # open myfile.txt at line 75 (works with vim, neovim, emacs, nano, micro)
   edit-in-kitty +75 myfile.txt

The :command:`edit-in-kitty` command allows you to seamlessly edit files
in your default :opt:`editor` in new kitty windows. This works even over
SSH (if you use the :doc:`ssh kitten <kittens/ssh>`), allowing you
to easily edit remote files in your local editor with all its bells and
whistles.

The :command:`edit-in-kitty` command takes almost all the same arguments as the
:doc:`launch <launch>` command, so you can open a new tab instead or a new OS
window, etc. Not all arguments are supported, see the discussion in the
:ref:`clone_shell` section above.

In order to avoid remote code execution, kitty will only execute the configured
editor and pass the file path to edit to it.

.. note:: To edit files using sudo the best method is to set the
   :code:`SUDO_EDITOR` environment variable to ``kitten edit-in-kitty`` and
   then edit the file using the ``sudoedit`` or ``sudo -e`` commands.


.. _run_shell:

Using shell integration in sub-shells, containers, etc.
-----------------------------------------------------------

.. versionadded:: 0.29.0

To start a sub-shell with shell integration automatically setup, simply run::

    kitten run-shell

This will start a sub-shell using the same binary as the currently running
shell, with shell-integration enabled. To start a particular shell use::

    kitten run-shell --shell=/bin/bash

To run a command before starting the shell use::

    kitten run-shell ls .

This will run ``ls .`` before starting the shell.

This will even work on remote systems where kitty itself is not installed,
provided you use the :doc:`SSH kitten <kittens/ssh>` to connect to the system.
Use ``kitten run-shell --help`` to learn more.

.. _manual_shell_integration:

Manual shell integration
----------------------------

The automatic shell integration is designed to be minimally intrusive, as such
it won't work for sub-shells, terminal multiplexers, containers, etc.
For such systems, you should either use the :ref:`run-shell <run_shell>` command described above or
setup manual shell integration by adding some code to your shells startup files to load the shell integration script.

First, in :file:`kitty.conf` set:

.. code-block:: conf

    shell_integration disabled

Then in your shell's rc file, add the lines:

.. tab:: zsh

    .. code-block:: sh

        if test -n "$KITTY_INSTALLATION_DIR"; then
            export KITTY_SHELL_INTEGRATION="enabled"
            autoload -Uz -- "$KITTY_INSTALLATION_DIR"/shell-integration/zsh/kitty-integration
            kitty-integration
            unfunction kitty-integration
        fi

.. tab:: fish

    .. code-block:: fish

        if set -q KITTY_INSTALLATION_DIR
            set --global KITTY_SHELL_INTEGRATION enabled
            source "$KITTY_INSTALLATION_DIR/shell-integration/fish/vendor_conf.d/kitty-shell-integration.fish"
            set --prepend fish_complete_path "$KITTY_INSTALLATION_DIR/shell-integration/fish/vendor_completions.d"
        end


.. tab:: bash

    .. code-block:: sh

        if test -n "$KITTY_INSTALLATION_DIR"; then
            export KITTY_SHELL_INTEGRATION="enabled"
            source "$KITTY_INSTALLATION_DIR/shell-integration/bash/kitty.bash"
        fi

The value of :envvar:`KITTY_SHELL_INTEGRATION` is the same as that for
:opt:`shell_integration`, except if you want to disable shell integration
completely, in which case simply do not set the
:envvar:`KITTY_SHELL_INTEGRATION` variable at all.

In a container, you will need to install the kitty shell integration scripts
and make sure the :envvar:`KITTY_INSTALLATION_DIR` environment variable is set
to point to the location of the scripts.

Integration with other shells
-------------------------------

There exist third-party integrations to use these features for various other
shells:

* Jupyter console and IPython via a patch (:iss:`4475`)
* `xonsh <https://github.com/xonsh/xonsh/issues/4623>`__
* `Nushell <https://github.com/nushell/nushell/discussions/12065>`__: Set ``$env.config.shell_integration = true`` in your ``config.nu`` to enable it.

Notes for shell developers
-----------------------------

The protocol used for marking the prompt is very simple. You should consider
adding it to your shell as a builtin. Many modern terminals make use of it, for
example: kitty, iTerm2, WezTerm, DomTerm

Just before starting to draw the PS1 prompt send the escape code:

.. code-block:: none

    <OSC>133;A<ST>

Just before starting to draw the PS2 prompt send the escape code:

.. code-block:: none

    <OSC>133;A;k=s<ST>

Just before running a command/program, send the escape code:

.. code-block:: none

    <OSC>133;C<ST>

Optionally, when a command is finished its "exit status" can be reported as:

.. code-block:: none

    <OSC>133;D;exit status as base 10 integer<ST>

Here ``<OSC>`` is the bytes ``0x1b 0x5d`` and ``<ST>`` is the bytes ``0x1b
0x5c``. This is exactly what is needed for shell integration in kitty. For the
full protocol, that also marks the command region, see `the iTerm2 docs
<https://iterm2.com/documentation-escape-codes.html>`_.

kitty additionally supports several extra fields for the ``<OSC>133;A`` command
to control its behavior, separated by semi-colons. They are:


``redraw=0``
    this tells kitty that the shell will not redraw the prompt on
    resize so it should not erase it

``special_key=1``
    this tells kitty to use a special key instead of arrow keys
    to move the cursor on mouse click. Useful if arrow keys have side-effects
    like triggering auto complete. The shell integration script then binds the
    special key, as needed.

``k=s``
    this tells kitty that the secondary (PS2) prompt is starting at the
    current line.

``click_events=1``
    this tells kitty that the shell is capable of handling
    mouse click events. kitty will thus send a click event to the shell when
    the user clicks somewhere in the prompt. The shell can then move the cursor
    to that position or perform some other appropriate action. Without this,
    kitty will instead generate a number of fake key events to move the cursor
    to the clicked location, which is not fully robust.

kitty also optionally supports sending the cmdline going to be executed with ``<OSC>133;C`` as:

.. code-block:: none

    <OSC>133;C;cmdline=cmdline encoded by %q<ST>
    or
    <OSC>133;C;cmdline_url=cmdline as UTF-8 URL %-escaped text<ST>


Here, *encoded by %q* means the encoding produced by the %q format to printf in
bash and similar shells. Which is basically shell escaping with the addition of
using `ANSI C quoting
<https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html#ANSI_002dC-Quoting>`__
for control characters (``$''`` quoting).
```

## File: docs/support.rst
```rst
Support kitty development ❤️
==============================

My goal with |kitty| is to move the stagnant terminal ecosystem forward.  To that
end kitty has many foundational features, such as: :doc:`image support
<graphics-protocol>`, :doc:`superlative performance <performance>`,
:doc:`various enhancements to the terminal protocol <protocol-extensions>`,
etc. These features allow the development of rich terminal applications, such
as :doc:`Side-by-side diff <kittens/diff>` and :doc:`Unicode input
<kittens/unicode_input>`.

If you wish to support this mission and see the terminal ecosystem evolve,
consider donating so that I can devote more time to |kitty| development.
I have personally written `almost all kitty code
<https://github.com/kovidgoyal/kitty/graphs/contributors>`_.

You can choose to make either a one-time payment via PayPal or become a
*patron* of kitty development via one of the services below:


.. raw:: html
    :file: support.html
```

## File: docs/text-sizing-protocol.rst
```rst
The text sizing protocol
==============================================

.. versionadded:: 0.40.0

Classically, because the terminal is a grid of equally sized characters, only
a single text size was supported in terminals, with one minor exception, some
characters were allowed to be rendered in two cells, to accommodate East Asian
square aspect ratio characters and Emoji. Here, by single text size we mean the
font size of all text on the screen is the same.

This protocol allows text to be displayed in the terminal in different sizes
both larger and smaller than the base text. It also solves the long standing
problem of robustly determining the width (in cells) a character should have.
Applications can interleave text of different sizes on the screen allowing for
typographic niceties like headlines, superscripts, etc.

Note that this protocol is fully backwards compatible, terminals that implement
it will continue to work just the same with applications that do not use it.
Because of this, it is not fully flexible in the font sizes it allows, as it
still has to work with the character cell grid based fundamental nature of the
terminal. Public discussion of this protocol is :iss:`here <8226>`.

Quickstart
--------------

Using this protocol to display different sized text is very simple, let's
illustrate with a few examples to give us a flavor:

.. code-block:: sh

   printf "\e]_text_size_code;s=2;Double sized text\a\n\n"
   printf "\e]_text_size_code;s=3;Triple sized text\a\n\n\n"
   printf "\e]_text_size_code;n=1:d=2;Half sized text\a\n"

Note that the last example, of half sized text, has half height characters, but
they still each take one cell, this can be fixed with a little more work:

.. code-block:: sh

   printf "\e]_text_size_code;n=1:d=2:w=1;Ha\a\e]66;n=1:d=2:w=1;lf\a\n"

The ``w=1`` mechanism allows the program to tell the terminal what width the text
should take. This not only fixes using smaller text but also solves the long
standing terminal ecosystem bugs caused by the client program not knowing how
many cells the terminal will render some text in.


The escape code
-----------------

There is a single escape code used by this protocol. It is sent by client
programs to the terminal emulator to tell it to render the specified text
at the specified size. It is an ``OSC`` code of the form::

    <OSC> _text_size_code ; metadata ; text <terminator>

Here, ``OSC`` is the bytes ``ESC ] (0x1b 0x5b)``. The ``metadata`` is a colon
separated list of ``key=value`` pairs. The final part of the escape code is the
text which is simply plain text encoded as :ref:`safe_utf8`, the text must be
no longer than ``4096`` bytes. Longer strings than that must be broken up into
multiple escape codes. Spaces in this definition are for clarity only and
should be ignored. The ``terminator`` is either the byte ``BEL (0x7)`` or the
bytes ``ESC ST (0x1b 0x5c)``.

There are only a handful of metadata keys, defined in the table below:


.. csv-table:: The text sizing metadata keys
   :header: "Key", "Value", "Default", "Description"

    "s", "Integer from 1 to 7",  "1", "The overall scale, the text will be rendered in a block of ``s * w`` by ``s`` cells"

    "w", "Integer from 0 to 7",  "0", "The width, in cells, in which the text should be rendered. When zero, the terminal should calculate the width as it would for normal text, splitting it up into scaled cells."

    "n", "Integer from 0 to 15", "0", "The numerator for the fractional scale."

    "d", "Integer from 0 to 15", "0", "The denominator for the fractional scale. Must be ``> n`` when non-zero."

    "v", "Integer from 0 to 2",  "0", "The vertical alignment to use for fractionally scaled text. ``0`` - top, ``1`` - bottom, ``2`` - centered"

    "h", "Integer from 0 to 2",  "0", "The horizontal alignment to use for fractionally scaled text. ``0`` - left, ``1`` - right, ``2`` - centered"


How it works
------------------

This protocol works by allowing the client program to tell the terminal to
render text in multiple cells. The terminal can then adjust the actual font
size used to render the specified text as appropriate for the specified space.

The space to render is controlled by four metadata keys, ``s (scale)``, ``w (width)``, ``n (numerator)``
and ``d (denominator)``. The most important are the ``s`` and ``w`` keys. The text
will be rendered in a block of ``s * w`` by ``s`` cells. A special case is ``w=0``
(the default), which means the terminal splits up the text into cells as it
would normally without this protocol, but now each cell is an ``s by s`` block of
cells instead. So, for example, if the text is ``abc`` and ``s=2`` the terminal would normally
split it into three cells::

    │a│b│c│

But, because ``s=2`` it instead gets split as::

    │a░│b░│c░│
    │░░│░░│░░│

The terminal multiplies the font size by ``s`` when rendering these
characters and thus ends up rendering text at twice the base size.

When ``w`` is a non-zero value, it specifies the width in scaled cells of the
following text. Note that **all** the text in that escape code must be rendered
in ``s * w`` cells. When both ``s`` and ``w`` are present, the resulting multicell
contains all the text in the escape code rendered in a grid of ``(s * w, s)``
cells, i.e. the multicell is ``s*w`` cells wide and ``s`` cells high.

If the text does not fit, the terminal is free to do whatever it
feels is best, including truncating the text or downsizing the font size when
rendering it. It is up to client applications to use the ``w`` key wisely and not
try to render too much text in too few cells. When sending a string of text
with non zero ``w`` to the terminal emulator, the way to do it is to split up the
text into chunks that fit in ``w`` cells and send one escape code per chunk. So
for the string: ``cool-🐈`` the actual escape codes would be (ignoring the header
and trailers)::

   w=1;c w=1;o w=1;o w=1;l w=1;- w=2:🐈

Note, in particular, how the last character, the cat emoji, ``🐈`` has ``w=2``.
In practice client applications can assume that terminal emulators get the
width of all ASCII code points correct and use the ``w=0`` form for efficient
transmission, so that the above becomes::

   cool- w=2:🐈

The use of non-zero ``w`` should mainly be restricted to non-ASCII characters and
when using fractional scaling, as described below.

.. note:: Text sizes specified by scale are relative to the base font size,
   thus if the base font size is changed, these sizes are changed as well.
   So if the terminal emulator is using a base font size of ``11pt``, then
   ``s=2`` will be rendered in approximately ``22pt`` (approx. because the
   terminal may need to slightly adjust font size to ensure it fits as not all
   fonts scale sizes linearly). If the user changes the base font size of the
   terminal emulator to ``12pt`` then the scaled font size becomes ``~24pt``
   and so on.


Fractional scaling
^^^^^^^^^^^^^^^^^^^^^^^

Using the main scale parameter (``s``) gives us only 7 font sizes. Fortunately,
this protocol allows specifying fractional scaling, fractional scaling is
applied on top of the main scale specified by ``s``. It allows niceties like:

* Normal sized text but with half a line of blank space above and half a line below (``s=2:n=1:d=2:v=2``)
* Superscripts (``n=1:d=2``)
* Subscripts (``n=1:d=2:v=1``)
* ...

The fractional scale **does not** affect the number of cells the text occupies,
instead, it just adjusts the rendered font size within those cells.
The fraction is specified using an integer numerator and denominator (``n`` and
``d``). In addition, by using the ``v`` key one can vertically align the
fractionally scaled text at top, bottom or middle. Similarly, the ``h`` key
does horizontal alignment — left, right or centered.

When using fractional scaling one often wants to fit more than a single
character per cell. To accommodate that, there is the ``w`` key. This specifies
the number of cells in which to render the text. For example, for a superscript
one would typically split the string into pairs of characters and use the
following for each pair::

    OSC _text_size_code ; n=1:d=2:w=1 ; ab <terminator>
    ... repeat for each pair of characters


Fixing the character width issue for the terminal ecosystem
---------------------------------------------------------------------

Terminals create user interfaces using text displayed in a cell grid. For
terminal software that creates sophisticated user interfaces it is particularly
important that the client program running in the terminal and the terminal
itself agree on how many cells a particular string should be rendered in. If
the two disagree, then the entire user interface can be broken, leading to
catastrophic failures.

Fundamentally, this is a co-ordination problem. Both the client program and the
terminal have to somehow share the same database of character properties and
the same algorithm for computing string lengths in cells based on that shared
database. Sadly, there is no such shared database in reality. The closest we
have is the Unicode standard. Unfortunately, the Unicode standard has a new
version almost every year and actually changes the width assigned to some
characters in different versions. Furthermore, to actually get the "correct"
width for a string using that standard one has to do grapheme segmentation,
which is a :ref:`complex algorithm, specified below <gseg>`.
Expecting all terminals and all terminal programs to have both up-to-date
character databases and a bug free implementation of this algorithm is not
realistic.

So instead, this protocol solves the issue robustly by removing the
co-ordination problem and putting only one actor in charge of determining
string width. The client becomes responsible for doing whatever level of
grapheme segmentation it is comfortable with using whatever Unicode database is
at its disposal and then it can transmit the segmented string to the terminal
with the appropriate ``w`` values so that the terminal renders the text in the
exact number of cells the client expects.

.. note::
   It is possible for a terminal to implement only the width part of this spec
   and ignore the scale part. This escape code works with only the `w` key as
   well, as a means of specifying how many cells each piece of text occupies.
   In such cases ``s`` defaults to 1.
   See the section on :ref:`detect_text_sizing` on how client applications can
   query for terminal emulator support.


Wrapping and overwriting behavior
-------------------------------------

If the multicell block (``s * w by s`` cells) is larger than the screen size in either
dimension, the terminal must discard the character. Note that in particular
this means that resizing a terminal screen so that it is too small to fit a
multicell character can cause the character to be lost.

When drawing a multicell character, if wrapping is enabled (DECAWM is set) and
the character's width (``s * w``) does not fit on the current line, the cursor is
moved to the start of the next line and the character is drawn there.
If wrapping is disabled and the character's width does not fit on the current
line, the cursor is moved back as far as needed to fit ``s * w`` cells and then
the character is drawn, following the overwriting rules described below.

When drawing text either normal text or text specified via this escape code,
and this text would overwrite an existing multicell character, the following
rules must be followed, in decreasing order of precedence:

#. If the text is a combining character it is added to the existing multicell
   character
#. If the text will overwrite the top-left cell of the multicell character, the
   entire multicell character must be erased
#. If the text will overwrite any cell in the topmost row of the multicell
   character, the entire multicell character must be replaced by spaces (this
   rule is present for backwards compatibility with how overwriting works for
   wide characters)
#. If the text will overwrite cells from a row after the first row, then cursor should be moved past the
   cells of the multicell character on that row and only then the text should be
   written. Note that this behavior is independent of the value of DECAWM. This
   is done for simplicity of implementation.

The skipping behavior of the last rule can be complex requiring the terminal to
skip over lots of cells, but it is needed to allow wrapping in the presence of
multicell characters that extend over more than a single line.

.. _detect_text_sizing:

Detecting if the terminal supports this protocol
-----------------------------------------------------

To detect support for this protocol use the `CPR (Cursor Position Report)
<https://vt100.net/docs/vt510-rm/CPR.html>`__ escape code. Send a ``CR``
(carriage return) followed by ``CPR`` followed by ``\e]_text_size_code;w=2; \a``
which will draw a space character in two cells, followed by another ``CPR``.
Then send ``\e]_text_size_code;s=2; \a`` which will draw a space in a ``2 by 2``
block of cells, followed by another ``CPR``.

Then wait for the three responses from the terminal to the three CPR queries.
If the cursor position in the three responses is the same, the terminal does
not support this protocol at all, if the second response has the cursor
moved by two cells, then the width part is supported and if the third response has the
cursor moved by another two cells, then the scale part is supported.


Interaction with other terminal controls
--------------------------------------------------

This protocol does not change the character grid based nature of the terminal.
Most terminal controls assume one character per cell so it is important to
specify how these controls interact with the multicell characters created by
this protocol.

Cursor movement
^^^^^^^^^^^^^^^^^^^

Cursor movement is unaffected by multicell characters, all cursor movement
commands move the cursor position by single cell increments, as has always been
the case for terminals. This means that the cursor can be placed at any
individual single cell inside a larger multicell character.

When a multicell character is created using this protocol, the cursor moves
`s * w` cells to the right, in the same row it was in.

Terminals *should* display a large cursor covering the entire multicell block
when the actual cursor position is on any cell within the block. Block cursors
cover all the cells of the multicell character, bar cursors appear in all the
cells in the first column of the character and so on.


Editing controls
^^^^^^^^^^^^^^^^^^^^^^^^^

There are many controls used to edit existing screen content such as
inserting characters, deleting characters and lines, etc. These were all
originally specified for the one character per cell paradigm. Here we specify
their interactions with multicell characters.

**Insert characters** (``CSI @`` aka ``ICH``)
    When inserting ``n`` characters at cursor position ``x, y`` all characters
    after ``x`` on line ``y`` are supposed to be right shifted. This means
    that any multi-line character that intersects with the cells on line ``y`` at ``x``
    and beyond must be erased. Any single line multicell character that is
    split by the cells at ``x`` and ``x + n - 1`` must also be erased.

**Delete characters** (``CSI P`` aka ``DCH``)
    When deleting ``n`` characters at cursor position ``x, y`` all characters
    after ``x`` on line ``y`` are supposed to be left shifted. This means
    that any multi-line character that intersects with the cells on line ``y`` at ``x``
    and beyond must be erased. Any single line multicell character that is
    split by the cells at ``x`` and ``x + n - 1`` must also be erased.

**Erase characters** (``CSI X`` aka ``ECH``)
    When erasing ``n`` characters at cursor position ``x, y`` the ``n`` cells
    starting at ``x`` are supposed to be cleared. This means that any multicell
    character that intersects with the ``n`` cells starting at ``x`` must be
    erased.

**Erase display** (``CSI J`` aka ``ED``)
    Any multicell character intersecting with the erased region of the screen
    must be erased. When using mode ``22`` the contents of the screen are first
    copied into the history, including all multicell characters.

**Erase in line** (``CSI K`` aka ``EL``)
    Works just like erase characters above. Any multicell character
    intersecting with the erased cells in the line is erased.

**Insert lines** (``CSI L`` aka ``IL``)
    When inserting ``n`` lines at cursor position ``y`` any multi-line
    characters that are split at the line ``y`` must be erased. A split happens
    when the second or subsequent row of the multi-line character is on the line
    ``y``. The insertion causes ``n`` lines to be removed from the bottom of
    the screen, any multi-line characters are split at the bottom of the screen
    must be erased. A split is when any row of the multi-line character except
    the last row is on the last line of the screen after the insertion of ``n``
    lines.

**Delete lines** (``CSI M`` aka ``DL``)
    When deleting ``n`` lines at cursor position ``y`` any multicell character
    that intersects the deleted lines must be erased.


.. _gseg:

The algorithm for splitting text into cells
------------------------------------------------

.. note::
   kitty comes with a utility to test terminal compliance with this algorithm.
   Install kitty and run: ``kitten __width_test__`` in any terminal to test it.
   This uses tests published by the Unicode consortium, `GraphemeBreakTest.txt
   <https://www.unicode.org/Public/UCD/latest/ucd/auxiliary/GraphemeBreakTest.txt>`__.

.. warning::
   This algorithm is under public discussion in :iss:`8533`. If serious issues
   are brought to light in that discussion, there may be small changes to the
   algorithm to address them. Additionally, in the future if the Unicode standard
   changes in ways that affect this algorithm, it will be updated. Currently the
   algorithm is based on Unicode version 16.

Here, we specify how a terminal must split up text into cells, where a cell is
a width one unit in the character grid the terminal displays.

The basis for the algorithm is the
`Grapheme segmentation algorithm <https://www.unicode.org/reports/tr29/#Grapheme_Cluster_Boundaries>`__
from the Unicode standard. However, that algorithm alone is insufficient to
fully specify text handling for terminals. The full algorithm is specified below.

A terminal using this algorithm must decode the bytes they receive
into Unicode scalar values (i.e., code points except surrogates) using UTF-8.
When it encounters any UTF-8 ill-formed subsequences,
it must be replace each
`maximal subpart of the ill-formed subsequence <https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-3/#G66453>`__
with a :code:`U+FFFD REPLACEMENT CHARACTER` (�).

For each decoded code point:

#. First check if the code point is an ASCII control code, and handle it
   appropriately. ASCII control codes are the code points less than :code:`U+0032` and the
   code point :code:`U+0127 DEL`. The code point :code:`U+0000 NUL` must be discarded.

#. Next, check if the code point is *invalid*, and if it is, discard it
   and finish processing. Invalid code points are code points with Unicode category :code:`Cc or Cs`
   and 66 additional code points: :code:`[0xfdd0, 0xfdef]`, :code:`[0xfffe, 0x10ffff-1, 0x10000]`
   and :code:`[0xffff, 0x10ffff, 0x10000]`.

#. Next, check if there is a previous cell before the
   current cursor position. This means either the cursor is at x > 0 in which
   case the previous cell is at x-1 on the same line, or the previous cell is
   the last cell of the previous line, provided there is no line break
   between the previous and current lines.

#. Next, calculate the width in cells of the received code point,
   which can be 0, 1, or 2 depending on the code point properties in
   the Unicode standard.

#. If there is no previous cell and the code point's width is zero,
   the code point is discarded and its processing is finished.

#. If there is a previous cell, the
   `Grapheme segmentation algorithm UAX29-C1-1 <https://www.unicode.org/reports/tr29/#C1-1>`__
   is used to determine if there is a grapheme boundary between the previous cell
   and the current code point.

#. If there is no boundary, the current code point is added to the previous
   cell and processing of the code point is finished. See the :ref:`var_select`
   section below for handling of Unicode Variation selectors.

#. If there is a boundary, but the width of the current code point is zero,
   it is added to the previous cell and processing is finished.

#. The code point is added to the current cell and the cursor is moved forward
   (right) by either 1 or 2 cells depending on the width of the code point.


It remains to specify how to calculate the width in cells of a code point.
To do this, code points are divided into various classes, as
described by the rules below, in order of decreasing priority:

.. note::
   Notation: :code:`[start, stop, step]` means the integers from :code:`start`
   to :code:`stop` in increments of :code:`step`. When the step is not
   specified, it defaults to one.

#. *Regional indicators*: 26 code points starting at :code:`0x1F1E6`. These all
   have width 2

#. *Doublewidth*: Parse `EastAsianWidth.txt
   <https://www.unicode.org/Public/UCD/latest/ucd/EastAsianWidth.txt>`__ from
   the Unicode standard. All code points marked :code:`W` or :code:`F` have
   width two. All code points in the following ranges have width two *unless*
   they are marked as :code:`A` in :code:`EastAsianWidth.txt`: :code:`[0x3400,
   0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF], [0x20000, 0x2FFFD], [0x30000, 0x3FFFD]`

#. *Wide emoji*: Parse `emoji-sequences.txt
   <https://www.unicode.org/Public/emoji/latest/emoji-sequences.txt>`__ from
   the Unicode standard. All :code:`Basic_Emoji` have width two unless they are
   followed by :code:`FE0F` in the file. The leading codepoints in all
   :code:`RGI_Emoji_Modifier_Sequence` and :code:`RGI_Emoji_Tag_Sequence` have width two.
   All code points in :code:`RGI_Emoji_Flag_Sequence` have width two.

#. *Marks*: These are all zero width code points. They are code points with Unicode
   categories whose first letter is :code:`M` or :code:`S`. Additionally,
   code points with Unicode category: :code:`Cf`. Finally, they include
   all modifier code points from :code:`RGI_Emoji_Modifier_Sequence` in the
   *Wide emoji* rule above.

#. All remaining code points have a width of one cell.

.. _var_select:

Unicode variation selectors
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

There are two code points (:code:`U+FE0E` and :code:`U+FE0F`) that can actually
alter the width of the previous code point. When adding a code point to the
previous cell these have to be handled specially.

``U+FE0E`` - Variation Selector 15
  When the previous cell has width two and the last code point in the previous
  cell is one of the ``Basic_Emoji`` code points from the *Wide emoji* rule above
  that is *not* followed by ``FEOF`` then the width of the previous cell is
  decreased to one.

``U+FE0F`` - Variation Selector 16
  When the previous cell has width one and the last code point in the previous
  cell is one of the ``Basic_Emoji`` code points from the *Wide emoji* rule above
  that is followed by ``FEOF`` then the width of the
  previous cell is increased to two.

Note that the rule for ``U+FE0E`` is particularly problematic for terminals as
it means that the width of a string cannot be determined without knowing the
width of the screen it will be rendered on. This is because when there is only
one cell left on the current line and a wide emoji is received it wraps onto
the next line. If subsequently a ``U+FE0E`` is received, the emoji becomes one
cell wide but it is *not* moved back to the previous line.

To avoid this issue, it is recommended applications detect when ``U+FE0E`` is
present and in such cases use the width part of the text sizing protocol
to control rendering.
```

## File: docs/underlines.rst
```rst
Colored and styled underlines
================================

|kitty| supports colored and styled (wavy) underlines. This is of particular use
in terminal based text editors such as :program:`vim` and :program:`emacs` to
display red, wavy underlines under mis-spelled words and/or syntax errors. This
is done by re-purposing some SGR escape codes that are not used in modern
terminals (`CSI codes <https://en.wikipedia.org/wiki/ANSI_escape_code#CSI_(Control_Sequence_Introducer)_sequences>`__)

To set the underline style::

    <ESC>[4:0m  # no underline
    <ESC>[4:1m  # straight underline
    <ESC>[4:2m  # double underline
    <ESC>[4:3m  # curly underline
    <ESC>[4:4m  # dotted underline
    <ESC>[4:5m  # dashed underline
    <ESC>[4m    # straight underline (for backwards compat)
    <ESC>[24m   # no underline (for backwards compat)

To set the underline color (this is reserved and as far as I can tell not
actually used for anything)::

    <ESC>[58...m

This works exactly like the codes ``38, 48`` that are used to set foreground and
background color respectively.

To reset the underline color (also previously reserved and unused)::

    <ESC>[59m

The underline color must remain the same under reverse video, if it has a color,
if not, it should follow the foreground color.

To detect support for this feature in a terminal emulator, query the terminfo
database for the ``Su`` boolean capability.
```

## File: docs/unscroll.rst
```rst
.. _unscroll:

Unscrolling the screen
========================

This is a small extension to the `SD (Pan up) escape code
<https://vt100.net/docs/vt510-rm/SD.html>`_ from the VT-420 terminal. The ``SD``
escape code normally causes the text on screen to scroll down by the specified
number of lines, with empty lines appearing at the top of the screen. This
extension allows the new lines to be filled in from the scrollback buffer
instead of being blank.

The motivation for this is that many modern shells will show completions in a
block of lines under the cursor, this causes some of the on-screen text to be
lost even after the completion is completed, because it has scrolled off
screen. This escape code allows that text to be restored.

If the scrollback buffer is empty or there is no scrollback buffer, such as for
the alternate screen, then the newly inserted lines must be empty, just as with
the original ``SD`` escape code. The maximum number of lines that can be
scrolled down is implementation defined, but must be at least one screen worth.

The syntax of the escape code is identical to that of ``SD`` except that it has
a trailing ``+`` modifier. This is legal under the `ECMA 48 standard
<https://www.ecma-international.org/publications-and-standards/standards/ecma-48/>`__
and unused for any other purpose as far as I can tell. So for example, to
unscroll three lines, the escape code would be::

    CSI 3 + T

See `discussion here
<https://gitlab.freedesktop.org/terminal-wg/specifications/-/issues/30>`__.

.. versionadded:: 0.20.2

Also supported by the terminals:

* `mintty <https://github.com/mintty/mintty/releases/tag/3.5.2>`__
```

## File: docs/wide-gamut-colors.rst
```rst
Wide gamut color formats
=========================

kitty supports modern wide gamut color formats for precise color specification.
These formats can be used anywhere a color value is accepted in the configuration
(foreground, background, color0-color255, etc.).

OKLCH Colors
------------

OKLCH is a perceptually uniform color space, ideal for creating color themes.
The format is::

    foreground oklch(0.9 0.05 140)
    color1     oklch(0.7 0.25 25)

Parameters:

- **L** (Lightness): 0 to 1, where 0 is black and 1 is white
- **C** (Chroma): 0 to approximately 0.4, represents color saturation
- **H** (Hue): 0 to 360 degrees (0=red, 120=green, 240=blue)

Benefits:

- Perceptually uniform - equal changes produce equal perceived differences
- Adjusting lightness preserves hue (unlike HSL)
- Industry standard for modern color design

Example::

    foreground oklch(0.9 0.05 140)
    color1     oklch(0.65 0.25 29)    # Vibrant red-orange
    color2     oklch(0.65 0.25 142)   # Vibrant green
    color3     oklch(0.70 0.19 90)    # Warm yellow

CIE LAB Colors
--------------

CIE LAB is a device-independent color space designed to approximate human vision.

The format is::

    background lab(20 5 -10)
    color4     lab(50 0 -50)

Parameters:

- **L**: Lightness, 0 to 100 (0 = black, 100 = white)
- **a**: Green (-) to red (+), typically -100 to +100
- **b**: Blue (-) to yellow (+), typically -100 to +100

Example::

    background lab(10 0 0)           # Very dark neutral gray
    foreground lab(90 0 0)           # Very light neutral gray
    color1     lab(50 60 40)         # Red
    color4     lab(50 0 -50)         # Blue

Gamut Mapping
-------------

When you specify colors in OKLCH or CIE LAB formats that are outside the sRGB
color gamut, kitty automatically converts them using the CSS Color Module Level 4
gamut mapping algorithm:

- Preserves the original lightness and hue as much as possible
- Reduces chroma (saturation) until the color fits within the displayable range
- Uses perceptual color difference (deltaE OK) to minimize visible changes
- Maximizes color saturation while staying in gamut

This ensures that wide gamut colors gracefully degrade on standard sRGB displays while
taking full advantage of wide gamut displays when available. The mapping happens
automatically - you don't need to do anything special.

For example, :code:`oklch(0.7 0.4 25)` might be too saturated for sRGB but will be
automatically adjusted to fit while preserving the perceived hue and lightness.

References
----------

- `CSS Color Module Level 4 <https://www.w3.org/TR/css-color-4/>`_
- `OKLCH Color Space <https://bottosson.github.io/posts/oklab/>`_
```