from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.remote.webelement import WebElement
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.remote.webdriver import WebDriver

class element_to_be_interactable(object):
    """
    An expectation for checking that an element is interactable.
    element - element in question that needs to become interactable.
    returns the boolean depending if it is interactable.
    """
    def __init__(self, element: WebElement):
        self.element: WebElement = element

    def __call__(self, driver: WebDriver) -> bool:
        element = EC.visibility_of(self.element)(driver)
        if element and element.is_enabled():
            return True
        return False

class text_to_be_present_in_element_value(object):
    """
    An expectation for checking if the given text is present in the element's
    locator, text
    """
    def __init__(self, element, text_):
        self.element = element
        self.text = text_

    def __call__(self, driver):
        try:
            element_text = self.element.get_attribute("value")
            if element_text:
                return self.text in element_text
            else:
                return False
        except StaleElementReferenceException:
                return False