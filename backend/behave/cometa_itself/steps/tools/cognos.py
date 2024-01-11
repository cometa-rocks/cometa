from .exceptions import *
from .common import *
from src.backend.utility.functions import *
import os
import time
import logging
from selenium.common.exceptions import StaleElementReferenceException, NoSuchElementException
from src.backend.common import *
from selenium.webdriver.common.by import By

# setup logging
logger = logging.getLogger('FeatureExecution')

"""
Python library with functions used for IBM Cognos
"""

def search_folder(context, folder_name):
    """
    Performs a folder search in the current IBM Cognos file explorer (Team Content)
    """
    # Make sure Team Folder is opened
    open_team_folder(context)
    # Open filter section
    elems = waitSelector(context, 'xpath', '//div[@id="teamFoldersSlideoutContent"]//*[@*="#common-filter"]/ancestor::button|//div[@id="teamFoldersSlideoutContent"]//*[@*="contentNavFilter"]')
    elems[0].click()
    # Type searched folder
    input_elem = waitSelector(context, 'css', '.contentsearchbar .searchinput')
    input_elem[0].send_keys(folder_name)
    # input_elem[0].send_keys(Keys.RETURN)
    # Now filter the displayed items and return the clickable folder element
    elems = waitSelector(context, 'css', '#teamFoldersSlideoutContent table tbody tr[data-name="%s"] td:nth-child(2) .name > div' % escapeSingleQuotes(folder_name))
    return elems[0]

# Opens the Team Folder sidenav (if not already opened)
def open_team_folder(context):
    logger.debug("Opening Teamfolder ... ")
    teamFolderBtn = waitSelector(context, 'css', '[id="com.ibm.bi.contentApps.teamFoldersSlideout"]')
    js='document.querySelector(\'[id="com.ibm.bi.contentApps.teamFoldersSlideout"]\').click()'
    try:
        context.browser.execute_script(js)
        logger.debug("Used javascript to click on teamfolder button")
        # wait 0.5s for slideout to open
        time.sleep(0.5)
    except:
        logger.debug("Found exception")

    # check folder is open
    teamFolderSlideContent = waitSelector(context, 'xpath', '//div[@id="teamFoldersSlideoutContent"]/parent::div')
    if len(teamFolderSlideContent) > 0 and element_has_class(teamFolderSlideContent[0], 'tabhidden'):
        # folder is closed ... sleep 0.5 and check again 
        time.sleep(0.5)
        teamFolderSlideContent = waitSelector(context, 'xpath', '//div[@id="teamFoldersSlideoutContent"]/parent::div')
        if len(teamFolderSlideContent) > 0 and element_has_class(teamFolderSlideContent[0], 'tabhidden'):
            logger.debug("Slideout is hidden")
            context.browser.execute_script(js)
            # wait 0.5s for slideout to open
            time.sleep(0.5)

    # check again, if folder is now open
    teamFolderSlideContent = waitSelector(context, 'xpath', '//div[@id="teamFoldersSlideoutContent"]/parent::div')
    if len(teamFolderSlideContent) > 0 and element_has_class(teamFolderSlideContent[0], 'tabhidden'):
        logger.debug("Team Folder is still closed")
    else:
        logger.debug("Team Folder is now open ")

def open_team_folder_1(context):
    """
    Use this function to make sure the IBM Cognos file explorer (Team Content) is opened
    """
    try:
        teamFolderSlideContent = waitSelector(context, 'xpath', '//div[@id="teamFoldersSlideoutContent"]/parent::div')
        if len(teamFolderSlideContent) > 0 and element_has_class(teamFolderSlideContent[0], 'tabhidden'):
            openBtn = waitSelector(context, 'css', '[id="com.ibm.bi.contentApps.teamFoldersSlideout"]')
            if len(openBtn) > 0:
                context.browser.execute_script("arguments[0].click();", openBtn[0])
                time.sleep(.5)
    except:
        teamFolderBtn = waitSelector(context, 'css', '[id="com.ibm.bi.contentApps.teamFoldersSlideout"]')
        context.browser.execute_script("arguments[0].click();", teamFolderBtn[0])
        time.sleep(2)


def clearFolderFilters(context):
    """
    Clears all filters in the IBM Cognos file explorer
    """
    # Make sure Team Folder is opened
    logger.debug("Open Team Folder")
    open_team_folder(context)
    # Check if current view is filtered
    filterByBtn = context.browser.find_element(By.CSS_SELECTOR, '#teamFoldersSlideoutContent .contentNavFilter')
    logger.debug("Checking if filter tab is opened")
    if element_has_class(filterByBtn, 'filtered'):
        logger.debug("Looking for .searchinput")
        # Check if search sidenav needs to be opened
        searchInputs = context.browser.find_elements(By.CSS_SELECTOR, '[id^="com.ibm.bi.contentApps.teamFoldersSlideout"] .searchinput')
        if len(searchInputs) == 0:
            logger.debug("Unable to find .searchinput, that means filter tab is closed, clicking on filter icon to open filters tab")
            # Open filter section
            elems = waitSelector(context, 'css', '#teamFoldersSlideoutContent .contentNavFilter')
            elems[0].click()
        logger.debug("Clicking on clear all filters")
        # Click on Clear all
        elems = waitSelector(context, 'css', '[id^="control_filterClearAll"]')
        elems[0].click()
        logger.debug("Clicking on filter icon to close filter tab")
        # Close filter section
        elems = waitSelector(context, 'css', '#teamFoldersSlideoutContent .contentNavFilter')
        elems[0].click()
    else:
        logger.debug("No filtering found")

def auto_select_cognos_prompts(context, **kwargs):
    """
    Automatically fills the prompt controls within a report prompt page

    @param parameters: Key value dict of parameters (optional)
    """

    # Load kwargs
    parameters = kwargs.get('parameters', {})
    iteration = 0
    while iteration<20:
        iteration += 1
        logger.debug('Prompt #%d' % iteration)

        # Wait for either the value prompts or the report content
        # ... There might by error pages in between ... with css:INPUT#cmdOK - they will fail the whole test
        logger.debug('Waiting for prompts or content to load')
        try:
            waitSelector(context, 'css', 'table[lid*=defaultPromptPage], .clsPromptComponent, .pageViewContent, body.viewer table, .clsViewerPage')
        except:
            logger.debug("No interesting content found ... this is most probly due to an error in the report. Will return false from prompt magic")
            return False

        # Check if current view is a prompt page
        # If it's not, it means the report has successfully loaded without any prompt
        clsPromptComponents = context.browser.find_elements(By.CSS_SELECTOR, '.clsPromptComponent:not([pt])')
        inputs = context.browser.find_elements(By.XPATH, '//table[@lid="defaultPromptPage"]//input/parent::td/parent::tr/parent::tbody/parent::table/parent::div')
        if len(inputs) > 0:
            if not inputs[0].is_displayed():
                inputs = []
        prompts = clsPromptComponents + inputs
        logger.debug(prompts)
        isPrompt = len(prompts) > 0
        if not isPrompt:
            logger.debug("This is not a promptpage ... so we might be done?")
            break
        print('Iteration %d: Found %d prompts in Cognos report.' % (iteration, len(prompts)))
        logger.debug('Iteration %d: Found %d prompts in Cognos report.' % (iteration, len(prompts)))
        for index, val in enumerate(prompts):
            # Auto select prompt value
            try:
                logger.debug("Prompt #%d --> Will call select prompt magic now" % (index+1) )
                selectCognosPrompt_rro(context, controlIndex=index, parameters=parameters, prompts=prompts)
            except PromptReferenceNotFound:
                logger.debug('Unable to get prompt reference input at iteration %d of input index %d' % (iteration, index))
                raise CustomError('Unable to get prompt reference input at iteration %d of input index %d' % (iteration, index))
            except PromptReferenceNameNotFound:
                logger.debug('Unable to get prompt reference name ID at iteration %d of input index %d' % (iteration, index))
                raise CustomError('Unable to get prompt reference name ID at iteration %d of input index %d' % (iteration, index))
            except PromptValueEmpty as id:
                logger.debug('Please provide a value for the prompt "%s"' % str(id))
                raise CustomError('Please provide a value for the prompt "%s"' % str(id))

        try:
            # Click on OK
            # Does not work reliable because of language .... context.browser.find_element(By.XPATH, "//div[@class=\"clsPromptComponent\"]/button[text()='OK']|//button[span=\"OK\"]|//button[.=\"Finish\"]").click()
            # Try clicking ok ... 
            # ... autogenerate prompts have "OK" Button
            # ... promptPages have a promptButton with type finsh in a generate attribute
            logger.debug("Trying to click ok on promptpage")
            # FIXME ... needs fallbacks for autosubmit, second promptpage with next .... 
            elem = context.browser.find_element(By.XPATH, "//div[@class=\"clsPromptComponent\"]/button[text()='OK']|//button[span=\"OK\"]|//button[@*=\"finish\" and not(@disabled)]|//button[@*=\"oCV_NS_.promptAction('finish')\" and not(@disabled)]")

            # if found click on submit
            elem.click()
            logger.debug("Clicked OK button")
        except NoSuchElementException:
            logger.info("NoSuchElementException  - so there might be no OK button or something else happened. You might want to have a look at this")
            return True
        except StaleElementReferenceException:
            # for some reason exception jumps after click this can be ignored.
            logger.debug("[NOK] For some reason exception jumps ... might look into this deeper at some time")
            return False
        except:
            logger.debug("Exception ... other element would receive the click or element not clickable")
            # sleep some time and click again
            time.sleep(0.5)
            try:
                elem.click()
                logger.debug("Clicked OK button")
            except:
                logger.debug("[NOK] Still haveing exception ... will pass")
                return False

        # Giving IBM Cognos page some time to react on click
        logger.debug("Sleeping 0.5s to give IBM Cognos page some time to react on the click")
        time.sleep(0.5)
        logger.debug("Waiting for IBM Cognos progress spinner to disappear")
        wait_until_selector_fails(context, '[src*="progress.gif"]')
        logger.debug(" ==> DONE with filling this prompt magic, there might be more ")

        return True

def auto_select_cognos_prompts_aso(context, **kwargs):
    """
    Automatically fills the prompt controls within a report prompt page

    @param parameters: Key value dict of parameters (optional)
    """

    # Load kwargs
    parameters = kwargs.get('parameters', {})
    iteration = 0
    while iteration<20:
        iteration += 1
        logger.debug('Prompt #%d' % iteration)

        # Wait for either the value prompts or the report content
        # ... There might by error pages in between ... with css:INPUT#cmdOK - they will fail the whole test
        logger.debug('Waiting for prompts or content to load')
        try:
            waitSelector(context, 'css', '.clsPromptComponent')
        except:
            logger.debug("It looks like there are no prompts to fill ... maybe there is an error or report really has no prompts and is correct.")
            logger.debug("Will return True anyways.")
            return True

        # Check if current view is a prompt page
        # If it's not, it means the report has successfully loaded without any prompt
        clsPromptComponents = context.browser.find_elements(By.CSS_SELECTOR, '.clsPromptComponent:not([pt])')
        # inputs = context.browser.find_elements(By.XPATH, '//table[@lid="defaultPromptPage"]//input/parent::td/parent::tr/parent::tbody/parent::table/parent::div')
        # if len(inputs) > 0:
        #    if not inputs[0].is_displayed():
        #        inputs = []
        prompts = clsPromptComponents # + inputs
        logger.debug(prompts)
        isPrompt = len(prompts) > 0
        if not isPrompt:
            logger.debug("This is not a promptpage ... so we might be done?")
            break
        print('Iteration %d: Found %d prompts in Cognos report.' % (iteration, len(prompts)))
        logger.debug('Iteration %d: Found %d prompts in Cognos report.' % (iteration, len(prompts)))
        for index, val in enumerate(prompts):
            # Auto select prompt value
            try:
                logger.debug("Prompt #%d --> Will call select prompt magic now" % (index+1) )
                selectCognosPrompt_rro(context, controlIndex=index, parameters=parameters, prompts=prompts)
            except PromptReferenceNotFound:
                logger.debug('Unable to get prompt reference input at iteration %d of input index %d' % (iteration, index))
                raise CustomError('Unable to get prompt reference input at iteration %d of input index %d' % (iteration, index))
            except PromptReferenceNameNotFound:
                logger.debug('Unable to get prompt reference name ID at iteration %d of input index %d' % (iteration, index))
                raise CustomError('Unable to get prompt reference name ID at iteration %d of input index %d' % (iteration, index))
            except PromptValueEmpty as id:
                logger.debug('Please provide a value for the prompt "%s"' % str(id))
                raise CustomError('Please provide a value for the prompt "%s"' % str(id))

        try:
            # Click on OK
            # Does not work reliable because of language .... context.browser.find_element(By.XPATH, "//div[@class=\"clsPromptComponent\"]/button[text()='OK']|//button[span=\"OK\"]|//button[.=\"Finish\"]").click()
            # Try clicking ok ... 
            # ... autogenerate prompts have "OK" Button
            # ... promptPages have a promptButton with type finsh in a generate attribute
            logger.debug("Trying to click ok on promptpage")
            # FIXME ... needs fallbacks for autosubmit, second promptpage with next .... 
            elem = context.browser.find_element(By.XPATH, "//div[@class=\"clsPromptComponent\"]/button[text()='OK']|//button[span=\"OK\"]|//button[@*=\"finish\" and not(@disabled)]|//button[@*=\"oCV_NS_.promptAction('finish')\" and not(@disabled)]")

            # if found click on submit
            elem.click()
            logger.debug("Clicked OK button")
        except StaleElementReferenceException:
            # for some reason exception jumps after click this can be ignored.
            logger.debug("[NOK] For some reason exception jumps ... might look into this deeper at some time")
            return False
        except NoSuchElementException as exc:
            logger.info("NoSuchElementException  - so there might be no OK button or something else happened. You might want to have a look at this")
        except:
            logger.debug("Exception ... other element would receive the click or element not clickable")
            # sleep some time and click again
            time.sleep(0.5)
            try:
                elem.click()
                logger.debug("Clicked OK button")
            except:
                logger.debug("[NOK] Still haveing exception ... will pass")
                return False

        # Giving IBM Cognos page some time to react on click
        logger.debug("Sleeping 0.5s to give IBM Cognos page some time to react on the click")
        time.sleep(0.5)
        logger.debug("Waiting for IBM Cognos progress spinner to disappear")
        wait_until_selector_fails(context, '[src*="progress.gif"]')
        logger.debug(" ==> DONE with filling this prompt magic, there might be more ")

        return True

def selectCognosPrompt(context, **kwargs):
    """ Selects a prompt option or value in a Cognos prompt page

        @param controlIndex: Index of the prompt control to set value
        @param optionIndex: Index of the option within the control (optional)
        @param parameters: Dict of parameters values to use (optional)
    """
    # Load kwargs
    logger.debug("Working on prompt selection")
    controlIndex = kwargs.get('controlIndex', None)
    if controlIndex is None:
        raise CustomError('No control index passed.')
    controlIndex = int(controlIndex)
    optionIndex = int(kwargs.get('optionIndex', -1)) # get last value if no option index is provided.
    prompts = kwargs.get('prompts', None)
    if prompts is None:
        # Look for all prompt controls in current view
        clsPromptComponents = context.browser.find_elements(By.CSS_SELECTOR, '.clsPromptComponent:not([pt])')
        inputs = context.browser.find_elements(By.XPATH, '//table[@lid="defaultPromptPage"]//input/parent::td/parent::tr/parent::tbody/parent::table/parent::div')
        prompts = clsPromptComponents + inputs
    parameters = kwargs.get('parameters', {})
    
    # Map to the selected control index
    selector = prompts[controlIndex]
    
    # Check if the prompt control has an input element, in that case is a basic control and we can inject default values if found
    input_element = selector.find_elements(By.CSS_SELECTOR, 'input:not([type=hidden])')
    if len(input_element) > 0:
        # Handle as: INPUT
        input_element = input_element[0]
        # Retrieve name ID of prompt control
        try:
            id = get_prompt_name_id(selector)
        except Exception as err:
            raise err
        # Remove prefix p_
        id = removePrefix(id, 'p_')
        print('ID:', id)
        # Check if we have default for the ID
        value = None
        # Try to use parameters for the value
        if id in parameters:
            value = parameters.get(id, None)
        # Try to set value on input
        if value:
            input_element.clear()
            input_element.send_keys(value)
        else:
            raise PromptValueEmpty(id)
    
    # Check if the prompt control is a selector
    option = selector.find_elements(By.CSS_SELECTOR, 'option,[type=checkbox],[type=radio]')
    if len(option) > 0:
        logger.debug("Check if prompt control is a selector returned true. Will try to hit #%s option index" % optionIndex)
        try:
            # Try to click on radio or checkbox
            option[optionIndex].click()
        except:
            # Try to set selected on selector option
            option[optionIndex].selected = True
    
    # Try to click on Insert button (for multiple selection prompt controls)
    insert = selector.find_elements(By.XPATH, './/button/span[text()=\'Insert\']/parent::button')
    if len(insert) > 0:
        logger.debug("Trying to click on insert button for multiple selection prompt controls")
        context.browser.execute_script("arguments[0].click();", insert[0])

def selectCognosPrompt_rro(context, **kwargs):
    """ Selects a prompt option or value in a Cognos prompt page

        @param controlIndex: Index of the prompt control to set value
        @param optionIndex: Index of the option within the control (optional)
        @param parameters: Dict of parameters values to use (optional)
    """
    # Load kwargs
    logger.debug("Working on prompt selection")
    controlIndex = kwargs.get('controlIndex', None)
    parameters = kwargs.get('parameters', {})

    # check if we have an index ... otherwhise fail
    if controlIndex is None:
        logger.debug("No control index passed")
        raise CustomError('No control index passed.')
    controlIndex = int(controlIndex)
    optionIndex = int(kwargs.get('optionIndex', -1)) # get last value if no option index is provided.
    prompts = kwargs.get('prompts', None)
    if prompts is None:
        # Look for all prompt controls in current view
        logger.debug("Looking for prompts in current view")
        clsPromptComponents = context.browser.find_elements(By.CSS_SELECTOR, '.clsPromptComponent:not([pt])')
        inputs = context.browser.find_elements(By.XPATH, '//table[@lid="defaultPromptPage"]//input/parent::td/parent::tr/parent::tbody/parent::table/parent::div')
        prompts = clsPromptComponents + inputs

    # Map to the selected control index
    selector = prompts[controlIndex]

    logger.debug("Inner HTML of selector")
    logger.debug(selector.get_attribute("innerHTML"))

    # Check if the prompt control has an input element, in that case is a basic control and we can inject default values if found
    input_element = selector.find_elements(By.CSS_SELECTOR, 'input:not([type=hidden])')
    if len(input_element) > 0:
        logger.debug("Prompt is input element")
        # Handle as: INPUT
        input_element = input_element[0]
        # Retrieve name ID of prompt control
        try:
            id = get_prompt_name_id(selector)
            logger.debug("Prompt ID: %s" % id )
        except Exception as err:
            raise err
        # Remove prefix p_
        id = removePrefix(id, 'p_')
        print('ID:', id)
        # Check if we have default for the ID
        value = None
        # Try to use parameters for the value
        if id in parameters:
            value = parameters.get(id, None)
            logger.debug("For ID: %s we have value: %s" % (id, value) )
        # Try to set value on input
        if value:
            input_element.clear()
            time.sleep(0.1)
            input_element.send_keys(value)
        # No value ... use dummy 12345 as value
        else:
            logger.info("There is no value for input field: [%s] - will use default value 12345" % id)
            input_element.clear()
            time.sleep(0.1)
            input_element.send_keys("12345")

    # Check if the prompt control is a selector
    option = selector.find_elements(By.CSS_SELECTOR, 'option,[type=checkbox],[type=radio]')
    if len(option) > 0:
        logger.debug("Prompt is a selector")
        # Retrieve name ID of prompt control
        try:
            id = get_prompt_name_id(selector)
            # Remove prefix p_
            id = removePrefix(id, 'p_')
            logger.debug("Prompt ID: %s" % id )
            logger.debug("===========================")
        except Exception as err:
            logger.debug("Found exception: Could not retrieve the promptID - will continue with index" )
            id = "there_was_no_prompt_id"

        # Try to use parameters for the value
        value = None
        if id in parameters:
            value = parameters.get(id, None)
            logger.debug("For ID: %s we have value: %s" % (id, value) )
        
        # If we have a value ... try to find it in selector
        if value:
            logger.debug("Value is set to %s - trying to find it in selector" % value)
            elm=selector.find_elements(By.XPATH, './/option[@value="%s"] | .//option[text()="%s"] | .//option[@dv="%s"]' % (value, value, value))
            if len(elm) > 0:
                logger.debug("Found option for the value")
                try:
                    elm[0].click()
                    logger.debug("Clicked on option")
                except:
                    elm[0].selected=True
                    logger.debug("Setting selected to true")
        # we have no value for this selector ... fallback to choosing the one with index=optionIndex
        else:
            logger.debug("No value for this selector. Will try to hit #%s option index" % optionIndex)
            try:
                # Try to click on radio or checkbox
                option[optionIndex].click()
            except:
                # Try to set selected on selector option
                option[optionIndex].selected = True

    # Try to click on Insert button (for multiple selection prompt controls)
    logger.debug("Looking for insert button on this prompt")
    # the starting "." declares to look only inside this element - https://stackoverflow.com/questions/14049983/selenium-webdriver-finding-an-element-in-a-sub-element
    insert = selector.find_elements(By.XPATH, './/button[@class="clsInsertRemoveButton"]')
    if len(insert) > 0:
        logger.debug("Found insert button trying to click on insert button for multiple selection prompt controls")
        context.browser.execute_script("arguments[0].click();", insert[0])
        logger.debug("Inner HTML of insert button")
        logger.debug(insert[0].get_attribute("innerHTML"))
    else:
        logger.debug("There is no insert button on this selector")

#
# FIXME ... missing documentation
#
def wait_until_selector_fails(context, selector, max_iterations=20):
    """

    THROWS WEBDRIVER NOT FOUND
    try:
        element = WebDriverWait(context.browser, 120).until(
                EC.invisibility_of_element_located((By.CSS_SELECTOR, selector)))
        return False
    except Exception as err:
        logger.error(str(err))
        return True

    """

    # Iterate over wait for element to a max of 20 seconds
    iterator=1
    while iterator<max_iterations:
        # search for something
        elements = context.browser.find_elements(By.CSS_SELECTOR, selector)
        # if not found ... try to exit infinite loop
        if len(elements) == 0:
            # sleep
            time.sleep(1)
            # check again just in case
            elements = context.browser.find_elements(By.CSS_SELECTOR, selector)
            # if not found ... break infite loop
            if len(elements) == 0:
                break
        # if found element ... go to sleep one second and ask again ... it does not make sense to ask the page in miliseconds for a selector
        time.sleep(1)
        # add on to the iterator
        iterator=iterator+1

    return False

def get_prompt_name_id(controlElement):
    # Get reference ID of prompt control
    element = controlElement.find_elements(By.CSS_SELECTOR, 'input[type=hidden]')
    # Try also to get reference ID from label
    label_element = controlElement.find_elements(By.CSS_SELECTOR, 'div[void]')
    if len(element) > 0:
        element = element[0]
        # Get name attribute, which contains the ID
        nameId = element.get_attribute('name')
        if nameId is None:
            raise PromptReferenceNameNotFound()
        return nameId
    elif len(label_element) > 0:
        label_element = label_element[0]
        # Get innerText, which contains the ID
        nameId = label_element.get_attribute("innerText")
        if nameId is None:
            raise PromptReferenceNameNotFound()
        return nameId
    else:
        raise PromptReferenceNotFound()
